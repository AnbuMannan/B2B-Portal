import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../database/database.service';
import { REQUIRE_SELLER_VERIFICATION_KEY } from '../decorators/seller-verification.decorator';

@Injectable()
export class SellerVerificationGuard implements CanActivate {
  private readonly logger = new Logger(SellerVerificationGuard.name);

  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresSellerVerification = this.reflector.get<boolean>(
      REQUIRE_SELLER_VERIFICATION_KEY,
      context.getHandler(),
    );

    if (!requiresSellerVerification) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    if (!user || user.role !== 'SELLER') {
      throw new ForbiddenException('Only sellers can access this endpoint');
    }

    const seller = await this.prisma.seller.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        userId: true,
        companyName: true,
        isVerified: true,
        kycStatus: true,
      },
    });

    if (!seller) {
      this.logger.warn(`Seller profile not found for user ${user.id}`);
      throw new ForbiddenException(
        'Seller profile not found. Please complete registration.',
      );
    }

    if (!seller.isVerified || seller.kycStatus !== 'APPROVED') {
      this.logger.warn(
        `Access denied: Seller ${seller.id} not verified. KYC Status: ${seller.kycStatus}`,
      );

      const message =
        seller.kycStatus === 'PENDING'
          ? 'Your KYC verification is pending. Please wait for admin approval.'
          : seller.kycStatus === 'REJECTED'
          ? 'Your KYC verification was rejected. Please contact support.'
          : 'Your seller account is not verified. Please complete KYC verification.';

      throw new ForbiddenException(message);
    }

    (request as any).seller = seller;

    this.logger.debug(
      `Seller verification succeeded: ${seller.id} (${seller.companyName})`,
    );

    return true;
  }
}
