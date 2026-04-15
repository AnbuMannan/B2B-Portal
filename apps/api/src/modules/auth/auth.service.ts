import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const otplib = require('otplib') as any;
const totp: any = new otplib.TOTP();
import * as QRCode from 'qrcode';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../database/database.service';
import { RedisService } from '../../services/redis/redis.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const BCRYPT_ROUNDS = 12;
const OTP_TTL_SECONDS = 300; // 5 minutes
const REFRESH_TOKEN_DAYS = 7;
const ACCESS_TOKEN_MINUTES = 24 * 60; // 24 hours

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    @InjectQueue('sms') private readonly smsQueue: Queue,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          ...(dto.phoneNumber ? [{ phoneNumber: dto.phoneNumber }] : []),
        ],
      },
    });

    if (existing) {
      throw new ConflictException('An account with this email or phone number already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const role = dto.role ?? 'BUYER';

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phoneNumber: dto.phoneNumber ?? null,
        passwordHash,
        role: role as any,
        phoneVerified: false,
      },
      select: { id: true, email: true, role: true, phoneNumber: true },
    });

    // Auto-create buyer profile
    if (user.role === 'BUYER') {
      await this.prisma.buyer.create({
        data: { userId: user.id, businessType: 'CONSUMER' as any },
      });
    }

    // Send OTP if phone provided
    if (user.phoneNumber) {
      await this.sendOtp(user.id, user.phoneNumber);
      this.logger.log(`OTP queued for new user: ${user.email}`);
      return { userId: user.id, message: `OTP sent to ${this.maskPhone(user.phoneNumber)}` };
    }

    // No phone — skip OTP, issue tokens directly
    const tokens = await this.issueTokens(user.id, user.email, user.role);
    return { ...tokens, user: { id: user.id, email: user.email, role: user.role } };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const otpKey = `otp:${dto.userId}`;
    const storedOtp = await this.redis.get<string>(otpKey);

    if (!storedOtp || storedOtp !== dto.otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Mark phone as verified
    const user = await this.prisma.user.update({
      where: { id: dto.userId },
      data: { phoneVerified: true },
      select: { id: true, email: true, role: true },
    });

    // Invalidate OTP
    await this.redis.delete(otpKey);

    // Issue tokens after OTP verification
    const tokens = await this.issueTokens(user.id, user.email, user.role);
    this.logger.log(`Phone verified for user: ${user.email}`);
    return { ...tokens, user: { id: user.id, email: user.email, role: user.role } };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, role: true, passwordHash: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.log(`User logged in: ${user.email}`);
    const tokens = await this.issueTokens(user.id, user.email, user.role);
    return { ...tokens, user: { id: user.id, email: user.email, role: user.role } };
  }

  async refreshToken(dto: RefreshTokenDto) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
      include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
    });

    if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!stored.user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Revoke old token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true },
    });

    const tokens = await this.issueTokens(stored.user.id, stored.user.email, stored.user.role);
    return tokens;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If that email is registered, a reset link has been sent' };
    }

    const resetToken = uuidv4();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: resetToken, passwordResetExpiry: expiry },
    });

    await this.emailQueue.add('password-reset', {
      to: user.email,
      resetToken,
      resetUrl: `${this.configService.get('app.frontendUrl') || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`,
      requestId: uuidv4(),
    });

    this.logger.log(`Password reset email queued for: ${user.email}`);
    return { message: 'If that email is registered, a reset link has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpiry: { gt: new Date() },
      },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    // Revoke all refresh tokens on password reset
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { isRevoked: true },
    });

    this.logger.log(`Password reset for: ${user.email}`);
    return { message: 'Password reset successful. Please log in with your new password.' };
  }

  /** Find buyer profile by userId — used by products enquiry endpoint. */
  async getBuyerByUserId(userId: string) {
    const buyer = await this.prisma.buyer.findUnique({
      where: { userId },
      select: { id: true, userId: true, businessType: true },
    });

    if (!buyer) {
      throw new ForbiddenException(
        'Buyer profile not found. Only registered buyers can submit enquiries.',
      );
    }

    return buyer;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async sendOtp(userId: string, phoneNumber: string): Promise<void> {
    const otp = this.generateOtp();
    const otpKey = `otp:${userId}`;

    await this.redis.set(otpKey, otp, OTP_TTL_SECONDS);

    await this.smsQueue.add('send-otp', {
      to: phoneNumber,
      otp,
      templateId: process.env.MSG91_OTP_TEMPLATE_ID || 'default-otp',
      requestId: uuidv4(),
    });
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.jwtService.sign(
      { sub: userId, email, role },
      { expiresIn: `${ACCESS_TOKEN_MINUTES}m` },
    );

    const refreshToken = uuidv4();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, token: refreshToken, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  private generateOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private maskPhone(phone: string): string {
    return phone.replace(/(\d{2})\d{6}(\d{2})/, '$1XXXXXX$2');
  }

  // ─── 2FA / TOTP ────────────────────────────────────────────────────────────

  /** Generate a new TOTP secret + QR code data URL. Does NOT enable 2FA yet. */
  async setup2fa(userId: string): Promise<{ secret: string; qrDataUrl: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } }) as any;
    if (!user) throw new NotFoundException('User not found');
    if (user.twoFaEnabled) throw new BadRequestException('2FA is already enabled');

    const secret = totp.generateSecret();
    const otpauthUrl = totp.toURI(user.email, secret, { issuer: 'B2B Portal' });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store secret temporarily (unverified) — overwrite any prior pending secret
    await (this.prisma.user as any).update({
      where: { id: userId },
      data: { twoFaSecret: secret, twoFaEnabled: false },
    });

    return { secret, qrDataUrl, otpauthUrl };
  }

  /** Verify the TOTP token and activate 2FA for the user. */
  async verify2fa(userId: string, token: string): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } }) as any;
    if (!user) throw new NotFoundException('User not found');
    if (!user.twoFaSecret) throw new BadRequestException('Run 2FA setup first');
    if (user.twoFaEnabled) throw new BadRequestException('2FA is already enabled');

    const isValid = totp.verify({ token, secret: user.twoFaSecret });
    if (!isValid) throw new BadRequestException('Invalid TOTP token — check your authenticator app');

    await (this.prisma.user as any).update({
      where: { id: userId },
      data: { twoFaEnabled: true },
    });

    this.logger.log(`2FA enabled for user: ${userId}`);
    return { enabled: true };
  }

  /** Disable 2FA after verifying a live TOTP token. */
  async disable2fa(userId: string, token: string): Promise<{ disabled: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } }) as any;
    if (!user) throw new NotFoundException('User not found');
    if (!user.twoFaEnabled) throw new BadRequestException('2FA is not currently enabled');

    const isValid = totp.verify({ token, secret: user.twoFaSecret });
    if (!isValid) throw new UnauthorizedException('Invalid TOTP token');

    await (this.prisma.user as any).update({
      where: { id: userId },
      data: { twoFaEnabled: false, twoFaSecret: null },
    });

    this.logger.log(`2FA disabled for user: ${userId}`);
    return { disabled: true };
  }

  /** Get 2FA status for the current user. */
  async get2faStatus(userId: string): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }, // twoFaEnabled not yet in generated client — fetched via raw
    });
    if (!user) throw new NotFoundException('User not found');
    const raw = await (this.prisma.user as any).findUnique({
      where: { id: userId },
      select: { twoFaEnabled: true },
    });
    return { enabled: raw?.twoFaEnabled ?? false };
  }
}
