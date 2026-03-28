import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../database/database.service';

export interface OwnershipCheckOptions {
  entityType: 'product' | 'seller' | 'order' | 'lead';
  paramName: string;
}

@Injectable()
export class OwnershipGuard implements CanActivate {
  private readonly logger = new Logger(OwnershipGuard.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    // Get ownership check options from decorator
    const options = this.reflector.get<OwnershipCheckOptions>(
      'ownership',
      context.getHandler(),
    );

    // If no ownership check required, allow
    if (!options) {
      return true;
    }

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Extract entity ID from route params
    const entityId = request.params[options.paramName];
    if (!entityId) {
      throw new BadRequestException(
        `Missing route parameter: ${options.paramName}`,
      );
    }

    // Check ownership based on entity type
    const isOwner = await this.checkOwnership(
      user.id,
      entityId,
      options.entityType,
    );

    if (!isOwner) {
      this.logger.warn(
        `Ownership check failed: User ${user.id} attempted to access ${options.entityType} ${entityId}`,
      );

      throw new ForbiddenException(
        'You do not have permission to access or modify this resource.',
      );
    }

    this.logger.debug(
      `Ownership verified: User ${user.id} owns ${options.entityType} ${entityId}`,
    );

    return true;
  }

  private async checkOwnership(
    userId: string,
    entityId: string,
    entityType: string,
  ): Promise<boolean> {
    try {
      switch (entityType) {
        case 'product':
          return await this.checkProductOwnership(userId, entityId);

        case 'seller':
          return await this.checkSellerOwnership(userId, entityId);

        case 'order':
          return await this.checkOrderOwnership(userId, entityId);

        case 'lead':
          return await this.checkLeadOwnership(userId, entityId);

        default:
          this.logger.warn(`Unknown entity type: ${entityType}`);
          return false;
      }
    } catch (error) {
      this.logger.error(
        `Error checking ownership: ${error}`,
      );
      return false;
    }
  }

  private async checkProductOwnership(
    userId: string,
    productId: string,
  ): Promise<boolean> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { seller: { select: { userId: true } } },
    });

    return product?.seller?.userId === userId;
  }

  private async checkSellerOwnership(
    userId: string,
    sellerId: string,
  ): Promise<boolean> {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: { userId: true },
    });

    return seller?.userId === userId;
  }

  private async checkOrderOwnership(
    userId: string,
    orderId: string,
  ): Promise<boolean> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        buyer: { select: { userId: true } },
        seller: { select: { userId: true } },
      },
    });

    // Order belongs to buyer OR seller
    return (
      order?.buyer?.userId === userId ||
      order?.seller?.userId === userId
    );
  }

  private async checkLeadOwnership(
    userId: string,
    leadId: string,
  ): Promise<boolean> {
    const lead = await this.prisma.buyLead.findUnique({
      where: { id: leadId },
      select: { buyer: { select: { userId: true } } },
    });

    return lead?.buyer?.userId === userId;
  }
}
