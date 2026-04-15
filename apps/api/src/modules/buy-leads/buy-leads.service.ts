import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client';
import * as crypto from 'crypto';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../database/database.service';
import { RedisService } from '../../services/redis/redis.service';
import { EncryptionUtil } from '../../common/utils/encryption.util';
import { BuyLeadsQueryDto, RevealedLeadsQueryDto } from './dto/buy-leads.dto';

@Injectable()
export class BuyLeadsService {
  private readonly logger = new Logger(BuyLeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly encryptionUtil: EncryptionUtil,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private cacheKey(prefix: string, params: object): string {
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex')
      .slice(0, 12);
    return `${prefix}:${hash}`;
  }

  private maskLead(lead: any) {
    return {
      id: lead.id,
      productName: lead.productName,
      quantity: lead.quantity ? parseFloat(String(lead.quantity)) : lead.quantityRequired,
      unit: lead.unit,
      expectedCountry: lead.expectedCountry ?? 'India',
      contactChannel: lead.contactChannel,
      repeatOption: lead.repeatOption,
      isOpen: lead.isOpen,
      postedAt: lead.createdAt,
      expiryDate: lead.expiryDate ?? lead.expiresAt,
      // Buyer details are masked
      buyerMasked: 'Verified Buyer',
    };
  }

  private safeDecryptField(value: string): string {
    try {
      return this.encryptionUtil.decryptPhone(value);
    } catch {
      // Seeded / legacy data may not be AES-GCM encrypted — return as-is
      return value;
    }
  }

  private async decryptReveal(reveal: any) {
    return {
      id: reveal.id,
      buyLeadId: reveal.buyLeadId,
      buyerPhoneNumber: this.safeDecryptField(reveal.buyerPhoneNumber),
      buyerEmail: this.safeDecryptField(reveal.buyerEmail),
      buyerWhatsapp: this.safeDecryptField(reveal.buyerWhatsapp),
      buyerGstin: reveal.buyerGstin,
      convertedToOrder: reveal.convertedToOrder ?? false,
      convertedAt: reveal.convertedAt ?? null,
      revealedAt: reveal.createdAt,
    };
  }

  // ─── Resolve seller from userId ──────────────────────────────────────────

  private async getVerifiedSeller(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      include: { leadCreditWallet: true },
    });
    if (!seller) {
      throw new ForbiddenException('Seller profile not found. Complete KYC to access buy leads.');
    }
    return seller;
  }

  // ─── List open buy leads (masked) ────────────────────────────────────────

  async getLeads(query: BuyLeadsQueryDto, userId: string) {
    // Ensure user has a seller profile
    await this.getVerifiedSeller(userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const ck = this.cacheKey('buy-leads:list', query);
    const cached = await this.redis.get<any>(ck);
    if (cached) return cached;

    const where: any = { isOpen: true, deletedAt: null };

    if (query.productName) {
      where.productName = { contains: query.productName, mode: 'insensitive' };
    }

    if (query.country) {
      where.expectedCountry = { contains: query.country, mode: 'insensitive' };
    }

    if (query.postedAfter && query.postedAfter !== 'all') {
      const now = new Date();
      const cutoff = new Date(now);
      if (query.postedAfter === 'today') cutoff.setHours(0, 0, 0, 0);
      else if (query.postedAfter === 'last3days') cutoff.setDate(cutoff.getDate() - 3);
      else if (query.postedAfter === 'lastweek') cutoff.setDate(cutoff.getDate() - 7);
      where.createdAt = { gte: cutoff };
    }

    const [total, leads] = await Promise.all([
      this.prisma.buyLead.count({ where }),
      this.prisma.buyLead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const result = {
      leads: leads.map((l) => this.maskLead(l)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.redis.set(ck, result, 300); // 5 min TTL
    return result;
  }

  // ─── Single lead detail (masked) ─────────────────────────────────────────

  async getLeadById(leadId: string, userId: string) {
    await this.getVerifiedSeller(userId);

    const lead = await this.prisma.buyLead.findUnique({
      where: { id: leadId },
    });

    if (!lead || !lead.isOpen || lead.deletedAt) {
      throw new NotFoundException('Buy lead not found or closed');
    }

    return this.maskLead(lead);
  }

  // ─── Reveal contact (idempotent, deducts 1 credit) ───────────────────────

  async revealContact(leadId: string, userId: string) {
    this.logger.debug(`[revealContact] START — leadId=${leadId} userId=${userId}`);

    const seller = await this.getVerifiedSeller(userId);
    this.logger.debug(`[revealContact] seller=${seller.id} kycStatus=${seller.kycStatus} walletBalance=${seller.leadCreditWallet?.balance}`);

    // KYC must be approved
    if (seller.kycStatus !== 'APPROVED') {
      throw new ForbiddenException('Your KYC must be approved before revealing contacts.');
    }

    // Idempotency: already revealed?
    const existing = await this.prisma.leadContactReveal.findFirst({
      where: { sellerId: seller.id, buyLeadId: leadId },
    });
    if (existing) {
      this.logger.debug(`[revealContact] already revealed — returning existing record`);
      const decrypted = await this.decryptReveal(existing);
      return { ...decrypted, alreadyRevealed: true };
    }

    // Get the buy lead with buyer's user info
    const lead = await this.prisma.buyLead.findUnique({
      where: { id: leadId },
      include: {
        buyer: { include: { user: true } },
      },
    });
    this.logger.debug(`[revealContact] lead found=${!!lead} isOpen=${lead?.isOpen} buyerId=${lead?.buyerId} buyerLoaded=${!!lead?.buyer} userLoaded=${!!lead?.buyer?.user}`);

    if (!lead || !lead.isOpen || lead.deletedAt) {
      throw new NotFoundException('Buy lead not found or closed');
    }

    // Check wallet balance
    const wallet = seller.leadCreditWallet;
    if (!wallet || parseFloat(wallet.balance.toString()) < 1) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_CREDITS',
        message: 'Recharge your lead credit wallet',
      });
    }

    // Encrypt buyer contact from User record.
    // phoneNumber is optional on User — fall back to 'N/A' so encryptField never
    // receives an empty string (which it rejects).
    const buyerUser = lead.buyer?.user;
    if (!buyerUser) {
      this.logger.error(`[revealContact] Lead ${leadId}: buyer user record not found. buyerId=${lead.buyerId} buyerLoaded=${!!lead.buyer}`);
      throw new InternalServerErrorException('Buyer contact information is unavailable. Please try again later.');
    }
    const phone = buyerUser.phoneNumber || 'N/A';
    this.logger.debug(`[revealContact] buyerUser=${buyerUser.id} phone=${phone ? 'set' : 'N/A'} email=${buyerUser.email ? 'set' : 'missing'}`);

    // Use a fresh UUID per attempt — the LeadContactReveal.findFirst above already
    // guarantees idempotency; a deterministic referenceId can cause P2002 if a prior
    // attempt left an orphaned LeadCreditTransaction that never got rolled back.
    const referenceId = uuidv4();

    // Atomic transaction: deduct credit + record reveal
    let reveal: any;
    try {
      // Wrap encryption inside the try-catch so crypto errors surface properly
      const encrypted = this.encryptionUtil.encryptLeadContact({
        buyerPhoneNumber: phone,
        buyerEmail: buyerUser.email || 'N/A',
        buyerWhatsapp: phone,
      });
      this.logger.debug(`[revealContact] encryption OK, starting transaction`);

      reveal = await this.prisma.$transaction(async (tx) => {
        await tx.leadCreditWallet.update({
          where: { sellerId: seller.id },
          data: {
            balance: { decrement: 1 },
            totalSpent: { increment: 1 },
          },
        });

        await tx.leadCreditTransaction.create({
          data: {
            sellerId: seller.id,
            walletId: wallet.id,
            type: 'SPEND',
            amount: 1,
            referenceId,
          },
        });

        return tx.leadContactReveal.create({
          data: {
            sellerId: seller.id,
            buyLeadId: leadId,
            buyerPhoneNumber: encrypted.buyerPhoneNumber,
            buyerEmail: encrypted.buyerEmail,
            buyerWhatsapp: encrypted.buyerWhatsapp,
            buyerGstin: lead.buyer?.gstinNumber ?? null,
            creditDeducted: true,
          },
        });
      });
    } catch (err: any) {
      // P2025: record to update not found (wallet row missing)
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new BadRequestException('Wallet record not found. Please refresh and try again.');
      }
      this.logger.error(`[revealContact] transaction failed for lead ${leadId}: code=${err?.code} meta=${JSON.stringify(err?.meta)} message=${err?.message}`, err.stack);
      throw new InternalServerErrorException(
        `Failed to reveal contact. No credits were deducted. Please try again.`,
      );
    }

    this.logger.log(`[revealContact] SUCCESS — seller ${seller.id} revealed lead ${leadId}`);
    const decrypted = await this.decryptReveal(reveal);
    return { ...decrypted, alreadyRevealed: false };
  }

  // ─── My revealed leads ────────────────────────────────────────────────────

  async getMyRevealedLeads(query: RevealedLeadsQueryDto, userId: string) {
    const seller = await this.getVerifiedSeller(userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const leadWhere: any = {};
    if (query.productName) {
      leadWhere.productName = { contains: query.productName, mode: 'insensitive' };
    }

    const [total, reveals] = await Promise.all([
      this.prisma.leadContactReveal.count({
        where: { sellerId: seller.id, buyLead: leadWhere },
      }),
      this.prisma.leadContactReveal.findMany({
        where: { sellerId: seller.id, buyLead: leadWhere },
        include: { buyLead: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items = await Promise.all(
      reveals.map(async (r) => {
        const decrypted = await this.decryptReveal(r);
        return {
          ...decrypted,
          lead: this.maskLead(r.buyLead),
        };
      }),
    );

    return {
      reveals: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Wallet balance (convenience endpoint until Module 11) ───────────────

  async getWalletBalance(userId: string) {
    const seller = await this.getVerifiedSeller(userId);
    const wallet = seller.leadCreditWallet;

    if (!wallet) {
      return { balance: 0, totalPurchased: 0, totalSpent: 0 };
    }

    return {
      balance: parseFloat(wallet.balance.toString()),
      totalPurchased: parseFloat(wallet.totalPurchased.toString()),
      totalSpent: parseFloat(wallet.totalSpent.toString()),
    };
  }

  // ─── Module 12: Matched leads ─────────────────────────────────────────────

  /**
   * Returns open buy leads that match the seller's approved product categories.
   * Sort: expiring soon (< 2 days) pinned first via SQL CASE WHEN, then newest.
   * Redis cache per seller per page: 5 min (key: seller:leads:{sellerId}:{page}).
   */
  async getMatchedLeads(userId: string, page: number, limit: number) {
    const seller = await this.getVerifiedSeller(userId);

    // Collect category IDs from seller's APPROVED active products
    const products = await this.prisma.product.findMany({
      where: { sellerId: seller.id, adminApprovalStatus: 'APPROVED', isActive: true },
      select: { categories: { select: { categoryId: true } } },
    });

    const categoryIds = [
      ...new Set(products.flatMap((p) => p.categories.map((c) => c.categoryId))),
    ];

    if (categoryIds.length === 0) {
      return { leads: [], total: 0, page, limit, totalPages: 0, hasCategories: false };
    }

    const cacheKey = `seller:leads:${seller.id}:${page}:${limit}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return { ...cached, fromCache: true };

    const now = new Date();
    const skip = (page - 1) * limit;

    // Raw query: CASE WHEN for "expiring soon" pinning — not achievable cleanly via Prisma orderBy
    type RawLead = {
      id: string; productName: string; quantity: any; unit: string | null;
      quantityRequired: number | null; expectedCountry: string | null;
      contactChannel: string; repeatOption: string; isOpen: boolean;
      createdAt: Date; expiryDate: Date | null; expiresAt: Date | null;
      categoryId: string | null;
    };

    const [countResult, leads] = await Promise.all([
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) AS count FROM "BuyLead"
        WHERE "categoryId" = ANY(${categoryIds}::text[])
          AND "isOpen" = true
          AND "deletedAt" IS NULL
          AND ("expiryDate" IS NULL OR "expiryDate" > ${now})
      `,
      this.prisma.$queryRaw<RawLead[]>`
        SELECT id, "productName", quantity, unit, "quantityRequired",
               "expectedCountry", "contactChannel", "repeatOption",
               "isOpen", "createdAt", "expiryDate", "expiresAt", "categoryId"
        FROM "BuyLead"
        WHERE "categoryId" = ANY(${categoryIds}::text[])
          AND "isOpen" = true
          AND "deletedAt" IS NULL
          AND ("expiryDate" IS NULL OR "expiryDate" > ${now})
        ORDER BY
          CASE WHEN "expiryDate" IS NOT NULL
                AND "expiryDate" < (${now}::timestamptz + INTERVAL '2 days')
               THEN 0 ELSE 1 END ASC,
          "createdAt" DESC
        LIMIT ${limit} OFFSET ${skip}
      `,
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const result = {
      leads: leads.map((l) => ({ ...this.maskLead(l), isMatched: true, categoryId: l.categoryId })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasCategories: true,
    };

    await this.redis.set(cacheKey, result, 300);
    return result;
  }

  /**
   * Combined feed: matched leads first (deduplicated), then all other open leads.
   * Paginated 20/page. Matched section always on page 1.
   */
  async getLeadFeed(userId: string, page: number, limit: number) {
    const seller = await this.getVerifiedSeller(userId);

    // Matched leads (always show on first chunk, regardless of page)
    const matched = await this.getMatchedLeads(userId, 1, 10);
    const matchedIds = new Set(matched.leads.map((l: any) => l.id));

    // All other open leads excluding already-matched
    const skip = (page - 1) * limit;
    const now = new Date();

    const excludeIds = matchedIds.size > 0
      ? { id: { notIn: [...matchedIds] as string[] } }
      : {};

    const [total, others] = await Promise.all([
      this.prisma.buyLead.count({
        where: {
          isOpen: true, deletedAt: null,
          OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
          ...excludeIds,
        },
      }),
      this.prisma.buyLead.findMany({
        where: {
          isOpen: true, deletedAt: null,
          OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
          ...excludeIds,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // On page 1: matched leads prepended, then fill with "others"
    const feed =
      page === 1
        ? [...matched.leads, ...others.map((l) => this.maskLead(l))]
        : others.map((l) => this.maskLead(l));

    return {
      leads: feed,
      matchedCount: matched.total,
      total: total + matched.total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) + (matched.total > 0 ? 1 : 0),
    };
  }

  // ─── Module 12: Save / unsave a lead ──────────────────────────────────────

  async saveLead(userId: string, leadId: string) {
    const seller = await this.getVerifiedSeller(userId);

    const lead = await this.prisma.buyLead.findUnique({ where: { id: leadId } });
    if (!lead || !lead.isOpen || lead.deletedAt) {
      throw new NotFoundException('Buy lead not found or closed');
    }

    // Toggle: if already saved, unsave; otherwise save
    const existing = await this.prisma.sellerSavedLead.findUnique({
      where: { sellerId_leadId: { sellerId: seller.id, leadId } },
    });

    if (existing) {
      await this.prisma.sellerSavedLead.delete({ where: { id: existing.id } });
      return { saved: false };
    }

    await this.prisma.sellerSavedLead.create({
      data: { sellerId: seller.id, leadId },
    });
    return { saved: true };
  }

  async getSavedLeads(userId: string, page: number, limit: number) {
    const seller = await this.getVerifiedSeller(userId);
    const skip = (page - 1) * limit;

    const [total, saved] = await Promise.all([
      this.prisma.sellerSavedLead.count({ where: { sellerId: seller.id } }),
      this.prisma.sellerSavedLead.findMany({
        where: { sellerId: seller.id },
        orderBy: { savedAt: 'desc' },
        skip,
        take: limit,
        include: { lead: true },
      }),
    ]);

    return {
      leads: saved.map((s) => ({
        ...this.maskLead(s.lead),
        savedAt: s.savedAt,
        isSaved: true,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Module 12: Saved lead IDs (for client-side state hydration) ──────────

  async getSavedLeadIds(userId: string): Promise<string[]> {
    const seller = await this.getVerifiedSeller(userId);
    const saved = await this.prisma.sellerSavedLead.findMany({
      where: { sellerId: seller.id },
      select: { leadId: true },
    });
    return saved.map((s) => s.leadId);
  }

  // ─── Module 12: Mark a revealed lead as converted ─────────────────────────

  async markConverted(userId: string, leadId: string) {
    const seller = await this.getVerifiedSeller(userId);

    const reveal = await this.prisma.leadContactReveal.findFirst({
      where: { sellerId: seller.id, buyLeadId: leadId },
    });

    if (!reveal) {
      throw new NotFoundException('You have not revealed this lead. Reveal the contact first.');
    }

    if (reveal.convertedToOrder) {
      return { convertedToOrder: true, alreadyMarked: true };
    }

    await this.prisma.leadContactReveal.update({
      where: { id: reveal.id },
      data: { convertedToOrder: true, convertedAt: new Date() },
    });

    this.logger.log(`Seller ${seller.id} marked lead ${leadId} as converted`);
    return { convertedToOrder: true, alreadyMarked: false };
  }

  // ─── G18: Post a new buy lead + notify matching sellers ──────────────────

  async postBuyLead(buyerUserId: string, dto: {
    productName: string;
    categoryId?: string;
    quantity?: number;
    unit?: string;
    targetPriceMin?: number;
    targetPriceMax?: number;
    expectedCountry?: string;
    contactChannel: string;
    repeatOption?: string;
    expiresInDays?: number;
  }) {
    // Resolve buyer record
    const buyer = await this.prisma.buyer.findFirst({ where: { userId: buyerUserId } });
    if (!buyer) throw new ForbiddenException('Buyer profile not found');

    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 3600 * 1000)
      : new Date(Date.now() + 30 * 24 * 3600 * 1000); // default 30 days

    const lead = await this.prisma.buyLead.create({
      data: {
        buyerId:        buyer.id,
        productName:    dto.productName,
        categoryId:     dto.categoryId ?? null,
        quantity:       dto.quantity ?? null,
        unit:           dto.unit ?? null,
        targetPriceMin: dto.targetPriceMin ?? null,
        targetPriceMax: dto.targetPriceMax ?? null,
        expectedCountry: dto.expectedCountry ?? 'India',
        contactChannel: dto.contactChannel as any,
        repeatOption:   (dto.repeatOption ?? 'NONE') as any,
        isOpen:         true,
        expiresAt,
        expiryDate:     expiresAt,
      },
    });

    this.logger.log(`Buy lead posted: ${lead.id} by buyer ${buyer.id}`);

    // ── Async: find matching sellers and notify them ──────────────────────
    this._notifyMatchingSellers(lead).catch((err) =>
      this.logger.warn(`Lead notification failed for ${lead.id}: ${err.message}`),
    );

    return { leadId: lead.id, productName: lead.productName, expiresAt };
  }

  private async _notifyMatchingSellers(lead: any) {
    // Find sellers whose approved products share the same category
    const whereCategory = lead.categoryId
      ? {
          categories: {
            some: { categoryId: lead.categoryId },
          },
        }
      : {
          name: { contains: lead.productName, mode: 'insensitive' as any },
        };

    const sellers = await this.prisma.seller.findMany({
      where: {
        kycStatus: 'APPROVED',
        isVerified: true,
        products: {
          some: {
            isActive: true,
            adminApprovalStatus: 'APPROVED',
            ...whereCategory,
          },
        },
      },
      select: { id: true, companyName: true, userId: true },
      take: 50, // cap to avoid fan-out storms
    });

    this.logger.log(
      `Lead ${lead.id}: notifying ${sellers.length} matching seller(s)`,
    );

    for (const seller of sellers) {
      // Create in-app notification
      await this.prisma.notification.create({
        data: {
          userId: seller.userId,
          type:   'NEW_LEAD',
          title:  `New buy lead: ${lead.productName}`,
          body:   `A buyer is looking for "${lead.productName}". Reveal contact to connect.`,
          isRead: false,
          metadata: { leadId: lead.id },
        },
      }).catch(() => undefined);

      // Queue email/SMS notification (best-effort)
      this.notificationsQueue.add('new-lead-match', {
        sellerId:    seller.id,
        userId:      seller.userId,
        companyName: seller.companyName,
        leadId:      lead.id,
        productName: lead.productName,
        type: 'EMAIL',
        templateId: 'new-lead-match',
        data: {
          companyName: seller.companyName,
          productName: lead.productName,
          leadId:      lead.id,
        },
        requestId: uuidv4(),
      }).catch(() => undefined);
    }
  }

  // ─── Module 12: Conversion rate stat ─────────────────────────────────────

  async getConversionRate(userId: string) {
    const seller = await this.getVerifiedSeller(userId);

    const [totalReveals, converted] = await Promise.all([
      this.prisma.leadContactReveal.count({ where: { sellerId: seller.id } }),
      this.prisma.leadContactReveal.count({
        where: { sellerId: seller.id, convertedToOrder: true },
      }),
    ]);

    const rate = totalReveals > 0 ? Math.round((converted / totalReveals) * 100) : 0;
    return { totalReveals, converted, conversionRate: rate };
  }
}
