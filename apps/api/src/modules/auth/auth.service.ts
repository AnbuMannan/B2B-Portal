import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/database.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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
      },
      select: { id: true, email: true, role: true },
    });

    // Auto-create buyer profile for BUYER role
    if (user.role === 'BUYER') {
      await this.prisma.buyer.create({
        data: {
          userId: user.id,
          businessType: 'CONSUMER' as any,
        },
      });
    }

    this.logger.log(`New user registered: ${user.email} (${user.role})`);

    const accessToken = this.signToken(user.id, user.email, user.role);
    return {
      accessToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
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

    const accessToken = this.signToken(user.id, user.email, user.role);
    return {
      accessToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  /**
   * Find buyer profile by userId — used by products enquiry endpoint.
   * Throws ForbiddenException if buyer profile doesn't exist (e.g. SELLER trying to enquire).
   */
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

  private signToken(userId: string, email: string, role: string): string {
    return this.jwtService.sign({ sub: userId, email, role });
  }
}
