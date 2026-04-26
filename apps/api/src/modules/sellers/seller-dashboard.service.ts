import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/database.service';
import { RedisService } from '../../services/redis/redis.service';

const LOW_BALANCE_THRESHOLD = 5;
const DASHBOARD_TTL = 30; // seconds

@Injectable()
export class SellerDashboardService {
  private readonly logger = new Logger(SellerDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getDashboard(userId: string) {
    const cacheKey = `dashboard:${userId}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    // select only fields needed — avoids fetching all 30+ seller columns
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      select: {
        id: true,
        companyName: true,
        kycStatus: true,
        rejectionReason: true,
        isVerified: true,
        gstNumber: true,
        iecCode: true,
        state: true,
        city: true,
        industryType: true,
        leadCreditWallet: {
          select: {
            balance: true,
            lastRechargeDate: true,
            transactions: {
              orderBy: { createdAt: 'desc' },
              take: 3,
              select: {
                id: true,
                type: true,
                amount: true,
                createdAt: true,
                referenceId: true,
              },
            },
          },
        },
      },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found. Please complete KYC first.');
    }

    const [
      activeListings,
      pendingListings,
      profileViews7d,
      profileViews30d,
      enquiriesReceived,
      activeOrders,
      recentLeads,
      recentOrders,
      unreadNotifications,
    ] = await Promise.all([
      this.prisma.product.count({
        where: { sellerId: seller.id, isActive: true, adminApprovalStatus: 'APPROVED' as any },
      }),
      this.prisma.product.count({
        where: { sellerId: seller.id, isActive: true, adminApprovalStatus: 'PENDING' as any },
      }),
      this.prisma.productViewTracking.aggregate({
        _sum: { viewCount: true },
        where: {
          product: { sellerId: seller.id },
          lastViewedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.productViewTracking.aggregate({
        _sum: { viewCount: true },
        where: {
          product: { sellerId: seller.id },
          lastViewedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.leadContactReveal.count({ where: { sellerId: seller.id } }),
      this.prisma.order.count({
        where: {
          sellerId: seller.id,
          status: { in: ['QUOTED', 'ACCEPTED'] as any[] },
          deletedAt: null,
        },
      }),
      this.getMatchingLeads(seller.id, []),
      this.prisma.order.findMany({
        where: { sellerId: seller.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          finalPrice: true,
          quotedPrice: true,
          createdAt: true,
          product: { select: { name: true } },
          buyer: { select: { user: { select: { email: true } } } },
        },
      }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    const wallet  = seller.leadCreditWallet;
    const balance = wallet ? Number(wallet.balance) : 0;

    const badges: string[] = [];
    if (seller.isVerified)         badges.push('VERIFIED_SELLER');
    if ((seller as any).gstNumber) badges.push('GST_VERIFIED');
    if ((seller as any).iecCode)   badges.push('IEC_GLOBAL');

    const result = {
      profile: {
        sellerId: seller.id,
        companyName: seller.companyName,
        kycStatus: seller.kycStatus,
        rejectionReason: seller.rejectionReason ?? null,
        badges,
        state: seller.state ?? null,
        city: seller.city ?? null,
      },
      kpis: {
        leadCreditBalance: balance,
        activeListings,
        pendingListings,
        profileViews7d:  profileViews7d._sum.viewCount  ?? 0,
        profileViews30d: profileViews30d._sum.viewCount ?? 0,
        enquiriesReceived,
        activeOrders,
        unreadNotifications,
      },
      recentLeads,
      recentOrders: recentOrders.map((o: any) => ({
        id: o.id,
        productName: o.product?.name ?? 'N/A',
        buyerMasked: this.maskEmail(o.buyer?.user?.email ?? ''),
        amount: o.finalPrice
          ? Number(o.finalPrice)
          : (o.quotedPrice ? Number(o.quotedPrice) : null),
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
      })),
      walletSummary: {
        balance,
        lastRechargeDate: wallet?.lastRechargeDate ?? null,
        lowBalanceAlert: balance < LOW_BALANCE_THRESHOLD,
        recentTransactions: wallet?.transactions.map((t: any) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          createdAt: t.createdAt,
          referenceId: t.referenceId,
        })) ?? [],
      },
    };

    await this.redis.set(cacheKey, result, DASHBOARD_TTL);
    return result;
  }

  async getNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, notifications] = await Promise.all([
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, type: true, title: true, body: true,
          isRead: true, link: true, createdAt: true,
        },
      }),
    ]);
    return { notifications, total, page, limit };
  }

  async markNotificationsRead(userId: string, notificationIds?: string[]) {
    const where: any = { userId };
    if (notificationIds?.length) where.id = { in: notificationIds };
    await this.prisma.notification.updateMany({ where, data: { isRead: true } });
    // Invalidate dashboard so unread count refreshes immediately
    await this.redis.delete(`dashboard:${userId}`);
    return { updated: true };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async getMatchingLeads(sellerId: string, _sellerIndustryTypes: string[]) {
    // Collect categoryIds from seller's APPROVED products (Module 12 schema: BuyLead.categoryId)
    const products = await this.prisma.product.findMany({
      where: { sellerId, adminApprovalStatus: 'APPROVED', isActive: true },
      select: { categories: { select: { categoryId: true } } },
    });

    const categoryIds = [
      ...new Set(products.flatMap((p) => p.categories.map((c) => c.categoryId))),
    ];

    const now = new Date();
    const where: any = {
      isOpen: true,
      deletedAt: null,
      contactReveals: { none: { sellerId } },
      OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
    };

    // Match by categoryId if the seller has products with known categories;
    // fall back to all open leads (for sellers with no approved products yet)
    if (categoryIds.length > 0) {
      where.categoryId = { in: categoryIds };
    }

    const leads = await this.prisma.buyLead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        productName: true,
        quantity: true,
        unit: true,
        quantityRequired: true,
        expectedCountry: true,
        contactChannel: true,
        repeatOption: true,
        createdAt: true,
        expiryDate: true,
        categoryId: true,
      },
    });

    return leads.map((l: any) => ({
      id: l.id,
      productName: l.productName,
      quantity: l.quantity ? Number(l.quantity) : l.quantityRequired,
      unit: l.unit ?? '',
      expectedCountry: l.expectedCountry ?? 'India',
      contactChannel: l.contactChannel,
      repeatOption: l.repeatOption,
      postedAt: l.createdAt,
      expiryDate: l.expiryDate,
      isMatched: categoryIds.length > 0,
    }));
  }

  async getOrders(userId: string, page: number, limit: number, status?: string) {
    const seller = await this.prisma.seller.findFirst({ where: { userId } });
    if (!seller) throw new NotFoundException('Seller profile not found');

    const skip = (page - 1) * limit;
    const where: any = { sellerId: seller.id, deletedAt: null };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          finalPrice: true,
          quotedPrice: true,
          negotiatedPrice: true,
          createdAt: true,
          updatedAt: true,
          product: { select: { id: true, name: true } },
          buyer: { select: { id: true, user: { select: { email: true, phoneNumber: true } } } },
          quotes: {
            orderBy: { createdAt: 'desc' as const },
            take: 1,
            select: {
              buyLead: { select: { productName: true } },
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((o: any) => {
        const productName = o.product?.name ?? o.quotes?.[0]?.buyLead?.productName ?? null;
        return {
          ...o,
          product: o.product ?? (productName ? { id: null, name: productName } : null),
          finalPrice: o.finalPrice ? Number(o.finalPrice) : null,
          quotedPrice: o.quotedPrice ? Number(o.quotedPrice) : null,
          buyerMasked: this.maskEmail(o.buyer?.user?.email ?? ''),
        };
      }),
      total,
      page,
      limit,
    };
  }

  async getLeadReveals(userId: string, page: number, limit: number) {
    const seller = await this.prisma.seller.findFirst({ where: { userId } });
    if (!seller) throw new NotFoundException('Seller profile not found');

    const skip = (page - 1) * limit;
    const where = { sellerId: seller.id };

    const [items, total] = await Promise.all([
      this.prisma.leadContactReveal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          creditDeducted: true,
          convertedToOrder: true,
          convertedAt: true,
          buyLead: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              deliveryState: true,
            },
          },
        },
      }),
      this.prisma.leadContactReveal.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async updateOrderStatus(userId: string, orderId: string, newStatus: string) {
    // Sellers may only mark an order FULFILLED — accepting/rejecting quotes is the buyer's job
    if (newStatus !== 'FULFILLED') {
      throw new BadRequestException('Sellers can only mark orders as FULFILLED');
    }

    const seller = await this.prisma.seller.findFirst({ where: { userId } });
    if (!seller) throw new NotFoundException('Seller profile not found');

    const order = await this.prisma.order.findFirst({ where: { id: orderId, sellerId: seller.id, deletedAt: null } });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== 'ACCEPTED') {
      throw new BadRequestException('Can only fulfill an order that the buyer has accepted');
    }
    if ((order as any).paymentStatus !== 'COMPLETED') {
      throw new BadRequestException('Cannot fulfill order — buyer payment not yet confirmed');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'FULFILLED' as any },
      select: { id: true, status: true, updatedAt: true },
    });

    return updated;
  }

  private maskEmail(email: string): string {
    if (!email) return 'Buyer ***';
    const [local, domain] = email.split('@');
    if (!domain) return `${local.slice(0, 2)}***`;
    return `${local.slice(0, 2)}***@${domain}`;
  }
}
