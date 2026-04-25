import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/database.service';
import { RedisService } from '../../services/redis/redis.service';
import { GstinService } from '../../services/government/gstin.service';
import {
  BusinessTypeDto,
  CompleteBuyerProfileDto,
  UpdateBuyerProfileDto,
} from './dto/buyer-profile.dto';

const DASHBOARD_TTL = 30; // seconds

@Injectable()
export class BuyerService {
  private readonly logger = new Logger(BuyerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gstinService: GstinService,
  ) {}

  // ─── POST /api/buyer/profile/complete ─────────────────────────────────────

  async completeProfile(userId: string, dto: CompleteBuyerProfileDto) {
    if (dto.businessType === BusinessTypeDto.COMPANY && !dto.gstinNumber) {
      throw new BadRequestException(
        'GSTIN is required when businessType is COMPANY',
      );
    }

    let isVerified = false;
    let verifiedLegalName: string | null = null;

    if (dto.gstinNumber) {
      const result = await this.gstinService.verify(dto.gstinNumber, userId);
      if (!result.valid) {
        throw new BadRequestException(
          result.error ?? 'GSTIN verification failed',
        );
      }
      isVerified = true;
      verifiedLegalName = result.legalName ?? null;
    }

    const existing = await this.prisma.buyer.findUnique({ where: { userId } });

    const data: any = {
      businessType: dto.businessType as any,
      gstinNumber: dto.gstinNumber ?? null,
      companyName:
        dto.companyName ??
        verifiedLegalName ??
        existing?.companyName ??
        null,
      isVerified,
    };

    const buyer = existing
      ? await this.prisma.buyer.update({ where: { userId }, data })
      : await this.prisma.buyer.create({ data: { userId, ...data } });

    // Invalidate cached dashboard
    await this.redis.delete(`buyer:dashboard:${userId}`);

    this.logger.log(
      `Buyer profile completed for user ${userId} — type=${dto.businessType}, verified=${isVerified}`,
    );

    return {
      buyerId: buyer.id,
      businessType: buyer.businessType,
      isVerified: buyer.isVerified,
      companyName: buyer.companyName,
      badge: this.badgeFor(buyer.businessType as any, buyer.isVerified),
    };
  }

  // ─── GET /api/buyer/dashboard ─────────────────────────────────────────────

  async getDashboard(userId: string) {
    const cacheKey = `buyer:dashboard:${userId}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const buyer = await this.prisma.buyer.findUnique({
      where: { userId },
      select: {
        id: true,
        businessType: true,
        isVerified: true,
        companyName: true,
        gstinNumber: true,
      },
    });

    if (!buyer) {
      throw new NotFoundException(
        'Buyer profile not found. Please complete your profile first.',
      );
    }

    const now = new Date();

    // Supabase session-mode pooler has a tight pool_size; running all 7 queries
    // in parallel exhausts it (MaxClientsInSessionMode). Serialize instead —
    // dashboard is cached for 30s, so the extra latency is only paid once per
    // user per cache window.
    const activeLeads = await this.prisma.buyLead.count({
      where: {
        buyerId: buyer.id,
        isOpen: true,
        deletedAt: null,
        OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
      },
    });
    const quotesReceived = await this.prisma.quote.count({
      where: { order: { buyerId: buyer.id, deletedAt: null } },
    });
    const ordersActive = await this.prisma.order.count({
      where: {
        buyerId: buyer.id,
        status: { in: ['QUOTED', 'ACCEPTED'] as any[] },
        deletedAt: null,
      },
    });
    const savedSellersCount = await this.prisma.buyerSavedSeller.count({
      where: { buyerId: buyer.id },
    });
    const recentLeads = await this.prisma.buyLead.findMany({
      where: { buyerId: buyer.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        productName: true,
        quantity: true,
        quantityRequired: true,
        unit: true,
        isOpen: true,
        expectedCountry: true,
        contactChannel: true,
        repeatOption: true,
        expiryDate: true,
        createdAt: true,
        category: { select: { id: true, name: true } },
        _count: { select: { contactReveals: true } },
      },
    });
    const recentQuotes = await this.prisma.quote.findMany({
      where: { order: { buyerId: buyer.id, deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        quotedPrice: true,
        leadTime: true,
        notes: true,
        status: true,
        createdAt: true,
        expiresAt: true,
        seller: { select: { id: true, companyName: true, isVerified: true } },
        product: { select: { id: true, name: true } },
      },
    });
    const recentOrders = await this.prisma.order.findMany({
      where: { buyerId: buyer.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        quotedPrice: true,
        finalPrice: true,
        createdAt: true,
        seller: { select: { id: true, companyName: true } },
        product: { select: { id: true, name: true } },
      },
    });

    const result = {
      profile: {
        buyerId: buyer.id,
        businessType: buyer.businessType,
        companyName: buyer.companyName,
        gstinNumber: buyer.gstinNumber,
        isVerified: buyer.isVerified,
        badge: this.badgeFor(buyer.businessType as any, buyer.isVerified),
      },
      stats: {
        activeLeads,
        quotesReceived,
        ordersActive,
        savedSellers: savedSellersCount,
      },
      recentLeads: recentLeads.map((l) => ({
        id: l.id,
        productName: l.productName,
        quantity: l.quantity ? Number(l.quantity) : l.quantityRequired,
        unit: l.unit ?? '',
        isOpen: l.isOpen,
        expectedCountry: l.expectedCountry,
        contactChannel: l.contactChannel,
        repeatOption: l.repeatOption,
        expiryDate: l.expiryDate,
        postedAt: l.createdAt,
        category: l.category,
        quotesCount: l._count?.contactReveals ?? 0,
      })),
      recentQuotes: recentQuotes.map((q) => ({
        id: q.id,
        sellerName: q.seller?.companyName ?? 'Unknown Seller',
        sellerId: q.seller?.id,
        sellerVerified: q.seller?.isVerified ?? false,
        productName: q.product?.name ?? 'N/A',
        quotedPrice: Number(q.quotedPrice),
        leadTime: q.leadTime,
        notes: q.notes,
        status: q.status,
        createdAt: q.createdAt,
        expiresAt: q.expiresAt,
      })),
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        productName: o.product?.name ?? 'N/A',
        sellerName: o.seller?.companyName ?? 'N/A',
        sellerId: o.seller?.id,
        amount:
          o.finalPrice != null
            ? Number(o.finalPrice)
            : o.quotedPrice != null
              ? Number(o.quotedPrice)
              : null,
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
      })),
    };

    await this.redis.set(cacheKey, result, DASHBOARD_TTL);
    return result;
  }

  // ─── GET /api/buyer/saved-sellers ────────────────────────────────────────

  async getSavedSellers(userId: string) {
    const buyer = await this.prisma.buyer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!buyer) {
      throw new NotFoundException('Buyer profile not found');
    }

    const rows = await this.prisma.buyerSavedSeller.findMany({
      where: { buyerId: buyer.id },
      orderBy: { savedAt: 'desc' },
    });

    const sellerIds = rows.map((r) => r.sellerId);
    const sellers = sellerIds.length
      ? await this.prisma.seller.findMany({
          where: { id: { in: sellerIds } },
          select: {
            id: true,
            companyName: true,
            isVerified: true,
            kycStatus: true,
            state: true,
            city: true,
            industryType: true,
            logoUrl: true,
            gstNumber: true,
            iecCode: true,
          },
        })
      : [];

    const sellerMap = new Map(sellers.map((s) => [s.id, s]));

    return rows
      .map((r) => {
        const s = sellerMap.get(r.sellerId);
        if (!s) return null;
        return {
          sellerId: s.id,
          companyName: s.companyName,
          isVerified: s.isVerified,
          kycStatus: s.kycStatus,
          location:
            [s.city, s.state].filter(Boolean).join(', ') || null,
          industryType: s.industryType,
          logoUrl: s.logoUrl,
          badges: [
            ...(s.isVerified ? ['VERIFIED_SELLER'] : []),
            ...(s.gstNumber ? ['GST_VERIFIED'] : []),
            ...(s.iecCode ? ['IEC_GLOBAL'] : []),
          ],
          savedAt: r.savedAt,
        };
      })
      .filter(Boolean);
  }

  async saveSeller(userId: string, sellerId: string) {
    const [buyer, seller] = await Promise.all([
      this.prisma.buyer.findUnique({ where: { userId }, select: { id: true } }),
      this.prisma.seller.findUnique({ where: { id: sellerId }, select: { id: true } }),
    ]);

    if (!buyer) throw new NotFoundException('Buyer profile not found');
    if (!seller) throw new NotFoundException('Seller not found');

    const existing = await this.prisma.buyerSavedSeller.findUnique({
      where: { buyerId_sellerId: { buyerId: buyer.id, sellerId: seller.id } },
    });

    if (existing) {
      await this.prisma.buyerSavedSeller.delete({
        where: { buyerId_sellerId: { buyerId: buyer.id, sellerId: seller.id } },
      });
      await this.redis.delete(`buyer:dashboard:${userId}`);
      return { saved: false };
    }

    await this.prisma.buyerSavedSeller.create({
      data: { buyerId: buyer.id, sellerId: seller.id },
    });
    await this.redis.delete(`buyer:dashboard:${userId}`);
    return { saved: true };
  }

  async removeSavedSeller(userId: string, sellerId: string) {
    const buyer = await this.prisma.buyer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!buyer) throw new NotFoundException('Buyer profile not found');

    await this.prisma.buyerSavedSeller
      .delete({
        where: {
          buyerId_sellerId: { buyerId: buyer.id, sellerId },
        },
      })
      .catch(() => null);

    await this.redis.delete(`buyer:dashboard:${userId}`);
    return { removed: true };
  }

  // ─── GET /api/buyer/profile ───────────────────────────────────────────────

  async getProfile(userId: string) {
    const buyer = await this.prisma.buyer.findUnique({
      where: { userId },
      select: {
        id: true,
        businessType: true,
        companyName: true,
        gstinNumber: true,
        isVerified: true,
        createdAt: true,
        user: { select: { email: true, phoneNumber: true } },
      },
    });
    if (!buyer) throw new NotFoundException('Buyer profile not found');
    return {
      ...buyer,
      badge: this.badgeFor(buyer.businessType as any, buyer.isVerified),
    };
  }

  // ─── PATCH /api/buyer/profile ─────────────────────────────────────────────

  async updateProfile(userId: string, dto: UpdateBuyerProfileDto) {
    const buyer = await this.prisma.buyer.findUnique({ where: { userId } });
    if (!buyer) throw new NotFoundException('Buyer profile not found');

    let isVerified = buyer.isVerified;
    let verifiedLegalName: string | null = null;

    if (dto.gstinNumber && dto.gstinNumber !== buyer.gstinNumber) {
      const result = await this.gstinService.verify(dto.gstinNumber, userId);
      if (!result.valid) {
        throw new BadRequestException(result.error ?? 'GSTIN verification failed');
      }
      isVerified = true;
      verifiedLegalName = result.legalName ?? null;
    }

    const updated = await this.prisma.buyer.update({
      where: { userId },
      data: {
        businessType: (dto.businessType as any) ?? buyer.businessType,
        gstinNumber: dto.gstinNumber ?? buyer.gstinNumber,
        companyName: dto.companyName ?? verifiedLegalName ?? buyer.companyName,
        isVerified,
      },
    });

    await this.redis.delete(`buyer:dashboard:${userId}`);
    return {
      buyerId: updated.id,
      businessType: updated.businessType,
      companyName: updated.companyName,
      isVerified: updated.isVerified,
      badge: this.badgeFor(updated.businessType as any, updated.isVerified),
    };
  }

  // ─── POST /api/buyer/save/product (toggle) ─────────────────────────────────

  async toggleSaveProduct(userId: string, productId: string) {
    const buyer = await this.prisma.buyer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!buyer) throw new NotFoundException('Buyer profile not found');

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const existing = await (this.prisma as any).buyerSavedProduct.findUnique({
      where: { buyerId_productId: { buyerId: buyer.id, productId } },
    });

    if (existing) {
      await (this.prisma as any).buyerSavedProduct.delete({
        where: { buyerId_productId: { buyerId: buyer.id, productId } },
      });
      return { saved: false };
    }

    await (this.prisma as any).buyerSavedProduct.create({
      data: { buyerId: buyer.id, productId },
    });
    return { saved: true };
  }

  // ─── GET /api/buyer/saved (unified saved sellers + products) ──────────────

  async getAllSaved(userId: string) {
    const buyer = await this.prisma.buyer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!buyer) throw new NotFoundException('Buyer profile not found');

    const [savedSellers, savedProducts] = await Promise.all([
      this.prisma.buyerSavedSeller.findMany({
        where: { buyerId: buyer.id },
        orderBy: { savedAt: 'desc' },
        select: {
          savedAt: true,
          sellerId: true,
        },
      }),
      (this.prisma as any).buyerSavedProduct.findMany({
        where: { buyerId: buyer.id },
        orderBy: { savedAt: 'desc' },
        select: {
          savedAt: true,
          product: {
            select: {
              id: true,
              name: true,
              images: true,
              multiTierPricing: true,
              seller: { select: { id: true, companyName: true, isVerified: true } },
            },
          },
        },
      }),
    ]);

    const sellerIds = savedSellers.map((s) => s.sellerId);
    const sellers = sellerIds.length
      ? await this.prisma.seller.findMany({
          where: { id: { in: sellerIds } },
          select: {
            id: true,
            companyName: true,
            isVerified: true,
            city: true,
            state: true,
            industryType: true,
            logoUrl: true,
          },
        })
      : [];
    const sellerMap = new Map(sellers.map((s) => [s.id, s]));

    return {
      sellers: savedSellers
        .map((s) => {
          const seller = sellerMap.get(s.sellerId);
          if (!seller) return null;
          return { ...seller, savedAt: s.savedAt };
        })
        .filter(Boolean),
      products: savedProducts.map((s) => ({
        ...s.product,
        savedAt: s.savedAt,
      })),
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const bcrypt = await import('bcrypt');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const hash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12'));
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    return { changed: true };
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private badgeFor(
    businessType: 'COMPANY' | 'TRADER' | 'CONSUMER',
    isVerified: boolean,
  ): string | null {
    if (businessType === 'COMPANY' && isVerified) return 'GST_BUYER';
    if (businessType === 'TRADER') return 'TRADER';
    return null;
  }
}
