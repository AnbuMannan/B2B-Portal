import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/database.service';
import { RazorpayService } from '../../../services/payment/razorpay.service';
import { RedisService } from '../../../services/redis/redis.service';
import { MarkPaidDto, VerifyOrderPaymentDto } from './dto/order.dto';

// Fulfillment is off-platform; no facilitation fee charged
const PLATFORM_FEE_RATE = 0;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly redis: RedisService,
  ) {}

  private async getBuyer(userId: string) {
    const buyer = await this.prisma.buyer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!buyer) throw new ForbiddenException('Buyer profile not found');
    return buyer;
  }

  // ── GET /api/buyer/orders ──────────────────────────────────────────────────

  async listOrders(userId: string, status?: string, page = 1, limit = 20) {
    const buyer = await this.getBuyer(userId);
    const skip = (page - 1) * limit;

    const where: any = { buyerId: buyer.id, deletedAt: null };
    if (status) where.status = status;

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          quotedPrice: true,
          finalPrice: true,
          platformFacilitationFee: true,
          createdAt: true,
          seller: { select: { id: true, companyName: true, isVerified: true } },
          product: { select: { id: true, name: true } },
          quotes: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { leadTime: true, notes: true, buyLead: { select: { productName: true } } },
          },
        },
      }),
    ]);

    return {
      data: orders.map((o) => this.formatOrder(o)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── GET /api/buyer/orders/:orderId ─────────────────────────────────────────

  async getOrder(userId: string, orderId: string) {
    const buyer = await this.getBuyer(userId);

    const order = await (this.prisma.order as any).findFirst({
      where: { id: orderId, buyerId: buyer.id, deletedAt: null },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        razorpayPaymentId: true,
        razorpayOrderId: true,
        quotedPrice: true,
        negotiatedPrice: true,
        finalPrice: true,
        platformFacilitationFee: true,
        createdAt: true,
        updatedAt: true,
        buyer: {
          select: {
            id: true,
            companyName: true,
            businessType: true,
            isVerified: true,
          },
        },
        seller: {
          select: {
            id: true,
            userId: true,
            companyName: true,
            isVerified: true,
            city: true,
            state: true,
            industryType: true,
          },
        },
        product: { select: { id: true, name: true, hsnCode: true } },
        quotes: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            quotedPrice: true,
            leadTime: true,
            notes: true,
            status: true,
            buyLead: { select: { productName: true } },
            negotiations: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                fromRole: true,
                counterPrice: true,
                message: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    const basePrice = order.finalPrice
      ? Number(order.finalPrice)
      : order.quotedPrice
        ? Number(order.quotedPrice)
        : 0;
    const platformFee =
      order.platformFacilitationFee != null
        ? Number(order.platformFacilitationFee)
        : Math.round(basePrice * PLATFORM_FEE_RATE * 100) / 100;
    const totalPayable = basePrice + platformFee;

    const leadProductName = (order as any).quotes?.[0]?.buyLead?.productName ?? null;
    const product = (order as any).product ?? (leadProductName ? { id: null, name: leadProductName, hsnCode: null } : null);

    return {
      ...this.formatOrder(order),
      seller: order.seller,
      product,
      buyer: order.buyer,
      quote: order.quotes[0] ?? null,
      pricing: {
        basePrice,
        platformFacilitationFee: 0,
        platformFeePercent: 0,
        totalPayable: basePrice,
        currency: 'INR',
      },
    };
  }

  // ── POST /api/buyer/orders/:orderId/pay ────────────────────────────────────

  async initiatePayment(userId: string, orderId: string) {
    const buyer = await this.getBuyer(userId);

    const order = await (this.prisma.order as any).findFirst({
      where: { id: orderId, buyerId: buyer.id, deletedAt: null },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        finalPrice: true,
        quotedPrice: true,
        platformFacilitationFee: true,
        razorpayOrderId: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (!['ACCEPTED'].includes(order.status as string)) {
      throw new BadRequestException('Only ACCEPTED orders can be paid');
    }
    if (order.paymentStatus === 'COMPLETED') {
      throw new BadRequestException('This order has already been paid');
    }

    // Return existing Razorpay order if already created
    if (order.razorpayOrderId) {
      return {
        razorpayOrderId: order.razorpayOrderId,
        keyId: this.razorpay.getKeyId(),
      };
    }

    const basePrice = order.finalPrice
      ? Number(order.finalPrice)
      : Number(order.quotedPrice ?? 0);
    const platformFee =
      order.platformFacilitationFee != null
        ? Number(order.platformFacilitationFee)
        : Math.round(basePrice * PLATFORM_FEE_RATE * 100) / 100;
    const totalPayable = basePrice + platformFee;
    const amountPaise = Math.round(totalPayable * 100);

    const rzpOrder = await this.razorpay.createOrder(amountPaise, orderId, {
      orderId,
      buyerId: buyer.id,
    });

    await (this.prisma.order as any).update({
      where: { id: orderId },
      data: { razorpayOrderId: rzpOrder.id },
    });

    return {
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: this.razorpay.getKeyId(),
    };
  }

  // ── POST /api/buyer/orders/:orderId/verify-payment ─────────────────────────

  async verifyPayment(
    userId: string,
    orderId: string,
    dto: VerifyOrderPaymentDto,
  ) {
    const buyer = await this.getBuyer(userId);

    const order = await (this.prisma.order as any).findFirst({
      where: { id: orderId, buyerId: buyer.id, deletedAt: null },
      select: { id: true, paymentStatus: true, razorpayOrderId: true },
    });

    if (!order) throw new NotFoundException('Order not found');

    const invalidateOrderCache = async () => {
      await this.redis.delete(`buyer:dashboard:${userId}`);
      await this.redis.delete(`cache:GET:/api/buyer/orders/${orderId}:u:${userId}`);
      await this.redis.delete(`cache:GET:/api/buyer/orders:u:${userId}`);
    };

    if (order.paymentStatus === 'COMPLETED') {
      await invalidateOrderCache();
      return { alreadyPaid: true };
    }

    const valid = this.razorpay.verifyPaymentSignature(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );

    if (!valid && !this.razorpay.isMockMode()) {
      throw new BadRequestException('Payment signature verification failed');
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'COMPLETED',
        paymentMethod: 'RAZORPAY',
        razorpayPaymentId: dto.razorpayPaymentId,
      },
    });

    await invalidateOrderCache();
    this.logger.log(`Order ${orderId} payment verified — ${dto.razorpayPaymentId}`);
    return { success: true };
  }

  // ── POST /api/buyer/orders/:orderId/mark-paid ─────────────────────────────

  async markPaid(userId: string, orderId: string, dto: MarkPaidDto) {
    const buyer = await this.getBuyer(userId);

    const order = await (this.prisma.order as any).findFirst({
      where: { id: orderId, buyerId: buyer.id, deletedAt: null },
      select: { id: true, status: true, paymentStatus: true },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'ACCEPTED') {
      throw new BadRequestException('Only ACCEPTED orders can be marked as paid');
    }
    const invalidateCache = async () => {
      await this.redis.delete(`buyer:dashboard:${userId}`);
      await this.redis.delete(`cache:GET:/api/buyer/orders/${orderId}:u:${userId}`);
      await this.redis.delete(`cache:GET:/api/buyer/orders:u:${userId}`);
    };

    if (order.paymentStatus === 'COMPLETED') {
      await invalidateCache();
      return { alreadyPaid: true };
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'COMPLETED',
        paymentMethod: 'OFFLINE',
        ...(dto.receiptUrl ? { razorpayPaymentId: dto.receiptUrl } : {}),
      },
    });

    await invalidateCache();
    this.logger.log(`Order ${orderId} marked PAID (offline) by buyer ${buyer.id}`);
    return { success: true };
  }

  // ── POST /api/buyer/orders/:orderId/confirm-delivery ──────────────────────

  async confirmDelivery(userId: string, orderId: string) {
    const buyer = await this.getBuyer(userId);

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, buyerId: buyer.id, deletedAt: null },
      select: { id: true, status: true, paymentStatus: true },
    });

    if (!order) throw new NotFoundException('Order not found');

    const invalidateDeliveryCaches = async () => {
      await this.redis.delete(`buyer:dashboard:${userId}`);
      await this.redis.delete(`cache:GET:/api/buyer/orders/${orderId}:u:${userId}`);
      await this.redis.delete(`cache:GET:/api/buyer/orders:u:${userId}`);
    };

    if (order.status === 'DELIVERED') {
      await invalidateDeliveryCaches();
      return { alreadyDelivered: true };
    }
    if (order.status !== 'FULFILLED') {
      throw new BadRequestException('Delivery can only be confirmed after the seller marks the order as fulfilled');
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'DELIVERED' },
    });

    await invalidateDeliveryCaches();
    this.logger.log(`Order ${orderId} marked DELIVERED by buyer ${buyer.id}`);
    return { delivered: true };
  }

  // ── PATCH /api/seller/orders/:orderId/fulfill ──────────────────────────────

  async sellerFulfillOrder(userId: string, orderId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!seller) throw new ForbiddenException('Seller profile not found');

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, sellerId: seller.id, deletedAt: null },
      select: { id: true, status: true, paymentStatus: true, buyer: { select: { userId: true } } },
    });

    if (!order) throw new NotFoundException('Order not found');

    const buyerUserId = (order as any).buyer?.userId;
    const invalidateFulfillCaches = async () => {
      await this.redis.delete(`cache:GET:/api/seller/orders:u:${userId}`);
      await this.redis.delete(`dashboard:${userId}`);
      if (buyerUserId) {
        await this.redis.delete(`cache:GET:/api/buyer/orders/${orderId}:u:${buyerUserId}`);
        await this.redis.delete(`cache:GET:/api/buyer/orders:u:${buyerUserId}`);
      }
    };

    if (order.status === 'FULFILLED' || order.status === 'DELIVERED') {
      await invalidateFulfillCaches();
      return { alreadyFulfilled: true };
    }
    if (order.status !== 'ACCEPTED') {
      throw new BadRequestException('Only ACCEPTED orders can be marked as fulfilled');
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'FULFILLED' },
    });

    await invalidateFulfillCaches();
    this.logger.log(`Order ${orderId} marked FULFILLED by seller ${seller.id}`);
    return { fulfilled: true, orderId };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private formatOrder(o: any) {
    const basePrice = o.finalPrice ? Number(o.finalPrice) : Number(o.quotedPrice ?? 0);
    const fee =
      o.platformFacilitationFee != null
        ? Number(o.platformFacilitationFee)
        : Math.round(basePrice * PLATFORM_FEE_RATE * 100) / 100;
    const productName =
      o.product?.name ?? o.quotes?.[0]?.buyLead?.productName ?? 'N/A';
    return {
      id: o.id,
      status: o.status,
      paymentStatus: o.paymentStatus,
      basePrice,
      platformFacilitationFee: fee,
      totalPayable: basePrice + fee,
      leadTime: o.quotes?.[0]?.leadTime ?? null,
      sellerName: o.seller?.companyName ?? 'Unknown',
      sellerId: o.seller?.id,
      sellerVerified: o.seller?.isVerified ?? false,
      productName,
      productId: o.product?.id ?? null,
      createdAt: o.createdAt,
    };
  }
}
