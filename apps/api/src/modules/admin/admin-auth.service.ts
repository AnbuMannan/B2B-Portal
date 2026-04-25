import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const otplib = require('otplib') as any;
const totp: any = new otplib.TOTP();
import { PrismaService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import { AdminLoginDto } from './dto/admin-login.dto';

// Admin sessions expire after 4 hours (shorter than seller 24h for security)
const ADMIN_SESSION_MINUTES = 240;

// Permission matrix — SUPER_ADMIN gets all; others get declared scopes
export const ADMIN_ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN:       ['kyc:approve', 'product:approve', 'user:manage', 'complaint:view'],
  REVIEWER:    ['product:review'],
  FINANCE:     ['finance:dashboard', 'refund:process'],
  SUPPORT:     ['complaint:manage'],
};

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: AdminLoginDto, ipAddress?: string, userAgent?: string) {
    const user = await (this.prisma.user as any).findUnique({
      where: { email: dto.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        adminRole: true,
        isActive: true,
        twoFaEnabled: true,
        twoFaSecret: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role !== 'ADMIN' || !user.adminRole) {
      // Generic message — don't reveal that an admin account exists
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      this.logger.warn(`Failed admin login attempt for ${dto.email} from ${ipAddress}`);
      await this.auditService.logAction({
        userId: user.id,
        entityType: 'ADMIN_AUTH',
        entityId: user.id,
        action: 'UPDATE',
        newValue: { event: 'LOGIN_FAILED', ip: ipAddress },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // TOTP enforcement disabled — re-enable once TOTP subscription is active
    // if (['ADMIN', 'SUPER_ADMIN'].includes(user.adminRole as string)) {
    //   if (!user.twoFaEnabled || !user.twoFaSecret) {
    //     throw new ForbiddenException(
    //       '2FA enrolment required. Please set up TOTP via the admin setup endpoint before logging in.',
    //     );
    //   }
    //   if (!dto.totpCode) {
    //     throw new BadRequestException('2FA code is required for this admin role');
    //   }
    //   const isValid = totp.verify({ token: dto.totpCode, secret: user.twoFaSecret });
    //   if (!isValid) {
    //     this.logger.warn(`Invalid 2FA code for admin ${dto.email} from ${ipAddress}`);
    //     throw new UnauthorizedException('Invalid 2FA code');
    //   }
    // }

    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        adminRole: user.adminRole,
        sessionType: 'admin',
      },
      { expiresIn: `${ADMIN_SESSION_MINUTES}m` },
    );

    await this.auditService.logAction({
      userId: user.id,
      entityType: 'ADMIN_AUTH',
      entityId: user.id,
      action: 'CREATE',
      newValue: {
        event: 'LOGIN_SUCCESS',
        adminRole: user.adminRole,
        ip: ipAddress,
        sessionExpiresInMinutes: ADMIN_SESSION_MINUTES,
      },
      ipAddress,
      userAgent,
    });

    this.logger.log(`Admin login: ${user.email} (${user.adminRole}) from ${ipAddress}`);

    return {
      accessToken,
      expiresIn: ADMIN_SESSION_MINUTES * 60,
      admin: {
        id: user.id,
        email: user.email,
        adminRole: user.adminRole,
        permissions: ADMIN_ROLE_PERMISSIONS[user.adminRole as string] ?? [],
      },
    };
  }
}
