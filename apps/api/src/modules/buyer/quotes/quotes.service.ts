import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../../database/database.service';
import { RedisService } from '../../../services/redis/redis.service';
import { NegotiateQuoteDto } from './dto/quote-actions.dto';

// Fulfillment happens outside the platform; no fee charged on buy-lead orders
const PLATFORM_FEE_RATE = 0;

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  // ─── GET /api/buyer/quotes ────────────────────────────────────────────────

  async listByRequirement(userId: string) {
    const buyer = await this.requireBuyer(userId);

    // Resolve order IDs first so the quote filter is unambiguous.
    // Using a nested relation filter (order: { buyerId }) can miss rows in
    // some Prisma versions; explicit IN is guaranteed to match.
    const buyerOrders = await this.prisma.order.findMany({
      where: { buyerId: buyer.id, deletedAt: null },
      select: { id: true },
    });
    const orderIds = buyerOrders.map((o) => o.id);

    if (orderIds.length === 0) {
      return { groups: [], total: 0 };
    }

    const quotes = await this.prisma.quote.findMany({
      where: { orderId: { in: orderIds } },
      orderBy: { createdAt: 'desc' },
      include: {
        seller: {
          select: {
            id: true,
            companyName: true,
            isVerified: true,
            gstNumber: true,
            iecCode: true,
            state: true,
            city: true,
            logoUrl: true,
          },
        },
        product: { select: { id: true, name: true } },
        order: { select: { id: true, status: true } },
        buyLead: { select: { id: true, productName: true, expiryDate: true } },
        _count: { select: { negotiations: true } },
      },
    });

    // Group by requirement (buyLeadId). Quotes without a buyLeadId fall
    // into an "Unassigned" bucket so they're still reachable.
    const groups = new Map<
      string,
      { requirement: any; quotes: any[] }
    >();

    for (const q of quotes) {
      const key = q.buyLeadId ?? '__unassigned__';
      if (!groups.has(key)) {
        groups.set(key, {
          requirement: q.buyLead
            ? {
                id: q.buyLead.id,
                productName: q.buyLead.productName,
                expiryDate: q.buyLead.expiryDate,
              }
            : { id: null, productName: 'Other quotes', expiryDate: null },
          quotes: [],
        });
      }
      groups.get(key)!.quotes.push(this.toQuoteSummary(q));
    }

    return {
      groups: Array.from(groups.values()).map((g) => ({
        requirement: g.requirement,
        quoteCount: g.quotes.length,
        quotes: g.quotes,
      })),
      total: quotes.length,
    };
  }

  // ─── GET /api/buyer/quotes/:id ────────────────────────────────────────────

  async getOne(userId: string, quoteId: string) {
    const buyer = await this.requireBuyer(userId);

    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, order: { buyerId: buyer.id } },
      include: {
        seller: {
          select: {
            id: true,
            companyName: true,
            isVerified: true,
            gstNumber: true,
            iecCode: true,
            state: true,
            city: true,
            logoUrl: true,
            industryType: true,
          },
        },
        product: { select: { id: true, name: true } },
        order: {
          select: {
            id: true,
            status: true,
            finalPrice: true,
            platformFacilitationFee: true,
          },
        },
        buyLead: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            unit: true,
            expiryDate: true,
            targetPriceMin: true,
            targetPriceMax: true,
            currency: true,
          },
        },
        negotiations: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!quote) throw new NotFoundException('Quote not found');

    return {
      ...this.toQuoteSummary(quote),
      seller: {
        id: quote.seller.id,
        companyName: quote.seller.companyName,
        isVerified: quote.seller.isVerified,
        industryType: (quote.seller as any).industryType ?? null,
        location:
          [quote.seller.city, quote.seller.state].filter(Boolean).join(', ') ||
          null,
        logoUrl: quote.seller.logoUrl,
        badges: [
          ...(quote.seller.isVerified ? ['VERIFIED_SELLER'] : []),
          ...(quote.seller.gstNumber ? ['GST_VERIFIED'] : []),
          ...(quote.seller.iecCode ? ['IEC_GLOBAL'] : []),
        ],
      },
      requirement: quote.buyLead
        ? {
            id: quote.buyLead.id,
            productName: quote.buyLead.productName,
            quantity: quote.buyLead.quantity
              ? Number(quote.buyLead.quantity)
              : null,
            unit: quote.buyLead.unit,
            expiryDate: quote.buyLead.expiryDate,
            targetPriceMin: quote.buyLead.targetPriceMin
              ? Number(quote.buyLead.targetPriceMin)
              : null,
            targetPriceMax: quote.buyLead.targetPriceMax
              ? Number(quote.buyLead.targetPriceMax)
              : null,
            currency: quote.buyLead.currency ?? 'INR',
          }
        : null,
      order: {
        id: quote.order.id,
        status: quote.order.status,
        finalPrice: quote.order.finalPrice
          ? Number(quote.order.finalPrice)
          : null,
        platformFacilitationFee: quote.order.platformFacilitationFee
          ? Number(quote.order.platformFacilitationFee)
          : null,
      },
      negotiations: quote.negotiations.map((n) => ({
        id: n.id,
        fromRole: n.fromRole,
        counterPrice: n.counterPrice ? Number(n.counterPrice) : null,
        message: n.message,
        createdAt: n.createdAt,
      })),
    };
  }

  // ─── POST /api/buyer/quotes/:id/accept ────────────────────────────────────

  async accept(userId: string, quoteId: string) {
    const buyer = await this.requireBuyer(userId);
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, order: { buyerId: buyer.id } },
      include: { order: true, seller: { select: { userId: true, companyName: true } } },
    });
    if (!quote) throw new NotFoundException('Quote not found');

    if (quote.status === 'ACCEPTED') {
      throw new BadRequestException('Quote already accepted');
    }
    if (quote.status === 'REJECTED') {
      throw new BadRequestException('Cannot accept a rejected quote');
    }

    const finalPrice = Number(quote.quotedPrice);
    const facilitationFee = +(finalPrice * PLATFORM_FEE_RATE).toFixed(2);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Accept this quote — WHERE includes status: PENDING as an optimistic lock.
      //    If a concurrent request already accepted it, Prisma throws P2025 and the tx rolls back.
      const updated = await tx.quote.updateMany({
        where: { id: quote.id, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });
      if (updated.count === 0) {
        throw new BadRequestException('Quote has already been accepted or rejected by another request');
      }

      // 2. Promote the associated Order to ACCEPTED with fee applied
      await tx.order.update({
        where: { id: quote.orderId },
        data: {
          status: 'ACCEPTED',
          finalPrice,
          platformFacilitationFee: facilitationFee,
        },
      });

      // 3. Reject all other pending quotes for the same requirement.
      //    Only scope to the same buyLead to avoid clobbering quotes on
      //    different requirements routed through the same buyer.
      if (quote.buyLeadId) {
        const siblingQuotes = await tx.quote.findMany({
          where: {
            buyLeadId: quote.buyLeadId,
            id: { not: quote.id },
            status: 'PENDING',
          },
          select: { id: true, orderId: true, sellerId: true },
        });

        if (siblingQuotes.length > 0) {
          await tx.quote.updateMany({
            where: { id: { in: siblingQuotes.map((s) => s.id) } },
            data: { status: 'REJECTED' },
          });
          await tx.order.updateMany({
            where: {
              id: { in: siblingQuotes.map((s) => s.orderId) },
              status: 'QUOTED',
            },
            data: { status: 'REJECTED' },
          });
        }

        return {
          rejectedSiblings: siblingQuotes,
        };
      }

      return { rejectedSiblings: [] as Array<{ sellerId: string }> };
    });

    // Notify accepted seller
    await this.createSellerNotification(
      quote.seller.userId,
      'QUOTE_ACCEPTED',
      `Your quote was accepted`,
      `Buyer accepted your quote of ₹${finalPrice.toLocaleString('en-IN')}. Order ${quote.orderId} is now live.`,
      { quoteId: quote.id, orderId: quote.orderId },
    );
    this.queueSellerEmail(quote.seller.userId, 'quote-accepted', {
      quoteId: quote.id,
      orderId: quote.orderId,
      finalPrice,
      companyName: quote.seller.companyName,
    });

    // Notify auto-rejected sellers
    for (const sibling of result.rejectedSiblings) {
      const seller = await this.prisma.seller.findUnique({
        where: { id: sibling.sellerId },
        select: { userId: true },
      });
      if (seller) {
        await this.createSellerNotification(
          seller.userId,
          'QUOTE_REJECTED',
          `Your quote was not selected`,
          `The buyer chose another supplier for this requirement.`,
          { quoteId: sibling.sellerId },
        );
      }
    }

    await this.redis.delete(`buyer:dashboard:${userId}`);
    await this.redis.delete(`cache:GET:/api/buyer/quotes:u:${userId}`);
    await this.redis.delete(`cache:GET:/api/buyer/quotes/${quoteId}:u:${userId}`);
    await this.redis.delete(`cache:GET:/api/buyer/orders:u:${userId}`);
    await this.redis.delete(`cache:GET:/api/buyer/orders/${quote.orderId}:u:${userId}`);
    await this.redis.delete(`cache:GET:/api/seller/orders:u:${quote.seller.userId}`);
    await this.redis.delete(`dashboard:${quote.seller.userId}`);

    this.logger.log(
      `Buyer ${buyer.id} accepted quote ${quote.id} — order ${quote.orderId} finalized at ₹${finalPrice}`,
    );

    return {
      quoteId: quote.id,
      orderId: quote.orderId,
      finalPrice,
      platformFacilitationFee: facilitationFee,
      rejectedCount: result.rejectedSiblings.length,
    };
  }

  // ─── POST /api/buyer/quotes/:id/reject ────────────────────────────────────

  async reject(userId: string, quoteId: string) {
    const buyer = await this.requireBuyer(userId);
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, order: { buyerId: buyer.id } },
      include: { seller: { select: { userId: true } } },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status !== 'PENDING') {
      throw new BadRequestException('Only pending quotes can be rejected');
    }

    await this.prisma.$transaction([
      this.prisma.quote.update({
        where: { id: quote.id },
        data: { status: 'REJECTED' },
      }),
      this.prisma.order.update({
        where: { id: quote.orderId },
        data: { status: 'REJECTED' },
      }),
    ]);

    await this.createSellerNotification(
      quote.seller.userId,
      'QUOTE_REJECTED',
      `Your quote was rejected`,
      `The buyer has rejected your quote.`,
      { quoteId: quote.id, orderId: quote.orderId },
    );

    await this.redis.delete(`buyer:dashboard:${userId}`);
    await this.redis.delete(`cache:GET:/api/buyer/quotes:u:${userId}`);
    await this.redis.delete(`cache:GET:/api/buyer/quotes/${quoteId}:u:${userId}`);
    await this.redis.delete(`cache:GET:/api/buyer/orders:u:${userId}`);
    await this.redis.delete(`cache:GET:/api/buyer/orders/${quote.orderId}:u:${userId}`);
    await this.redis.delete(`cache:GET:/api/seller/orders:u:${quote.seller.userId}`);
    await this.redis.delete(`dashboard:${quote.seller.userId}`);

    this.logger.log(`Buyer ${buyer.id} rejected quote ${quote.id}`);
    return { quoteId: quote.id, status: 'REJECTED' };
  }

  // ─── POST /api/buyer/quotes/:id/negotiate ─────────────────────────────────

  async negotiate(
    userId: string,
    quoteId: string,
    dto: NegotiateQuoteDto,
  ) {
    const buyer = await this.requireBuyer(userId);
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, order: { buyerId: buyer.id } },
      include: { seller: { select: { userId: true } } },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status !== 'PENDING') {
      throw new BadRequestException(
        'Only pending quotes can be negotiated',
      );
    }

    const message = (dto.message ?? '').trim() ||
      `Counter-offer: ₹${dto.counterPrice}`;

    const negotiation = await this.prisma.negotiationMessage.create({
      data: {
        quoteId: quote.id,
        fromRole: 'BUYER',
        counterPrice: dto.counterPrice,
        message,
      },
    });

    // Update the Order's negotiatedPrice so the seller sees the latest ask
    await this.prisma.order.update({
      where: { id: quote.orderId },
      data: { negotiatedPrice: dto.counterPrice },
    });

    await this.createSellerNotification(
      quote.seller.userId,
      'QUOTE_NEGOTIATE',
      `Buyer sent a counter-offer`,
      `Counter price ₹${dto.counterPrice.toLocaleString('en-IN')} — review and respond.`,
      { quoteId: quote.id, counterPrice: dto.counterPrice },
    );

    await this.redis.delete(`cache:GET:/api/buyer/quotes:u:${userId}`);
    await this.redis.delete(`cache:GET:/api/buyer/quotes/${quoteId}:u:${userId}`);
    await this.redis.delete(`cache:GET:/api/buyer/orders/${quote.orderId}:u:${userId}`);

    return {
      id: negotiation.id,
      quoteId: quote.id,
      counterPrice: Number(negotiation.counterPrice),
      message: negotiation.message,
      createdAt: negotiation.createdAt,
    };
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private async requireBuyer(userId: string) {
    const buyer = await this.prisma.buyer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!buyer) throw new ForbiddenException('Buyer profile not found');
    return buyer;
  }

  private toQuoteSummary(q: any) {
    return {
      id: q.id,
      status: q.status,
      quotedPrice: Number(q.quotedPrice),
      leadTime: q.leadTime,
      notes: q.notes,
      createdAt: q.createdAt,
      expiresAt: q.expiresAt,
      negotiationCount: q._count?.negotiations ?? 0,
      seller: {
        id: q.seller.id,
        companyName: q.seller.companyName,
        isVerified: q.seller.isVerified,
        logoUrl: q.seller.logoUrl,
        location:
          [q.seller.city, q.seller.state].filter(Boolean).join(', ') || null,
        badges: [
          ...(q.seller.isVerified ? ['VERIFIED_SELLER'] : []),
          ...(q.seller.gstNumber ? ['GST_VERIFIED'] : []),
          ...(q.seller.iecCode ? ['IEC_GLOBAL'] : []),
        ],
      },
      product: q.product ? { id: q.product.id, name: q.product.name } : null,
      orderId: q.order?.id ?? q.orderId,
      orderStatus: q.order?.status ?? null,
    };
  }

  private async createSellerNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    metadata: Record<string, any>,
  ) {
    try {
      await this.prisma.notification.create({
        data: { userId, type, title, body, isRead: false, metadata },
      });
    } catch (err: any) {
      this.logger.warn(`Notification create failed: ${err.message}`);
    }
  }

  private queueSellerEmail(
    userId: string,
    templateId: string,
    data: Record<string, any>,
  ) {
    this.notificationsQueue
      .add(templateId, {
        userId,
        type: 'EMAIL',
        templateId,
        data,
        requestId: uuidv4(),
      })
      .catch((err) => this.logger.warn(`Email queue failed: ${err.message}`));
  }
}
