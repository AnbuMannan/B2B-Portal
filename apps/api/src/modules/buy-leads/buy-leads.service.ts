import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/database.service';
import { RedisService } from '../../services/redis/redis.service';
import { EncryptionUtil } from '../../common/utils/encryption.util';
import { BuyLeadFilterDto, RevealedLeadsQueryDto, SubmitQuoteDto } from './dto/buy-leads.dto';

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
    const expiryDate = lead.expiryDate ?? lead.expiresAt ?? null;
    const now = Date.now();
    const expiringIn3Days = expiryDate
      ? new Date(expiryDate).getTime() - now < 3 * 24 * 60 * 60 * 1000 && new Date(expiryDate).getTime() > now
      : false;

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
      expiryDate,
      requirementType: lead.requirementType ?? null,
      currency: lead.currency ?? 'INR',
      targetPriceMin: lead.targetPriceMin ? parseFloat(String(lead.targetPriceMin)) : null,
      targetPriceMax: lead.targetPriceMax ? parseFloat(String(lead.targetPriceMax)) : null,
      deliveryState: lead.deliveryState ?? null,
      categoryId: lead.categoryId ?? null,
      isGstVerified: !!(lead.buyer?.gstinNumber),
      isExpiringSoon: expiringIn3Days,
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
      include: {
        leadCreditWallet: true,
        user: { select: { lastLoginAt: true } },
      },
    });
    if (!seller) {
      throw new ForbiddenException('Seller profile not found. Complete KYC to access buy leads.');
    }
    return seller;
  }

  // ─── List open buy leads (masked) with full filter support ───────────────

  async getLeads(query: BuyLeadFilterDto, userId: string) {
    const seller = await this.getVerifiedSeller(userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // Cache key includes userId so reveal-status filters are seller-scoped
    const ck = this.cacheKey('buy-leads:list', { ...query, userId });
    const cached = await this.redis.get<any>(ck);
    if (cached) return cached;

    const where: any = { isOpen: true, deletedAt: null };

    // ── 1. Product name search ──────────────────────────────────────────────
    if (query.productName) {
      where.productName = { contains: query.productName, mode: 'insensitive' };
    }

    // ── 2. Country filter ───────────────────────────────────────────────────
    // null expectedCountry is treated as 'India' (see maskLead), so domestic
    // must include nulls and international must exclude them.
    if (query.country) {
      if (query.country === 'domestic') {
        where.OR = [
          { expectedCountry: { contains: 'India', mode: 'insensitive' } },
          { expectedCountry: null },
        ];
      } else if (query.country === 'international') {
        where.expectedCountry = { not: null };
        where.NOT = { expectedCountry: { contains: 'India', mode: 'insensitive' } };
      } else {
        where.expectedCountry = { contains: query.country, mode: 'insensitive' };
      }
    }

    // ── 3. State/region filter (domestic leads only) ────────────────────────
    if (query.deliveryState?.length) {
      where.deliveryState = { in: query.deliveryState };
    }

    // ── 4. Time period filter ───────────────────────────────────────────────
    let periodCutoff: Date | null = null;
    if (query.period && query.period !== 'all') {
      const now = new Date();
      periodCutoff = new Date(now);
      if (query.period === 'today') periodCutoff.setHours(0, 0, 0, 0);
      else if (query.period === '7d') periodCutoff.setDate(periodCutoff.getDate() - 7);
      else if (query.period === '30d') periodCutoff.setDate(periodCutoff.getDate() - 30);
    }

    // ── 5. Requirement type ─────────────────────────────────────────────────
    if (query.requirementType) {
      where.requirementType = query.requirementType;
    }

    // ── 6. Quantity range ───────────────────────────────────────────────────
    if (query.qtyMin !== undefined || query.qtyMax !== undefined) {
      where.quantity = {};
      if (query.qtyMin !== undefined) where.quantity.gte = query.qtyMin;
      if (query.qtyMax !== undefined) where.quantity.lte = query.qtyMax;
    }

    // ── 7. New leads only (since seller's last login) ───────────────────────
    let newCutoff: Date | null = null;
    if (query.newOnly) {
      newCutoff = seller.user?.lastLoginAt ?? null;
    }

    // Merge period + newOnly cutoffs → use the most-recent (restrictive) one
    const createdAtCutoff = [periodCutoff, newCutoff]
      .filter((d): d is Date => d !== null)
      .reduce<Date | null>((latest, d) => (!latest || d > latest ? d : latest), null);
    if (createdAtCutoff) {
      where.createdAt = { gte: createdAtCutoff };
    }

    // ── 8. Viewed / unviewed (reveal audit log) ─────────────────────────────
    if (query.revealStatus === 'viewed') {
      where.contactReveals = { some: { sellerId: seller.id } };
    } else if (query.revealStatus === 'unviewed') {
      where.contactReveals = { none: { sellerId: seller.id } };
    }

    // ── 9. Buyer GST verified ───────────────────────────────────────────────
    if (query.buyerVerified) {
      where.buyer = { gstinNumber: { not: null } };
    }

    // ── 10. Contact channel ─────────────────────────────────────────────────
    if (query.contactChannel?.length) {
      where.contactChannel = { in: query.contactChannel.map((c) => c.toUpperCase()) };
    }

    // ── 11. Category filter ─────────────────────────────────────────────────
    if (query.categories?.length) {
      where.categoryId = { in: query.categories };
    }

    // ── 12. Expiry filter ───────────────────────────────────────────────────
    if (query.expiry && query.expiry !== 'all') {
      const future = new Date();
      if (query.expiry === '3d') future.setDate(future.getDate() + 3);
      else if (query.expiry === '7d') future.setDate(future.getDate() + 7);
      where.expiryDate = { not: null, lte: future };
    }

    // ── Price range filter ──────────────────────────────────────────────────
    if (query.priceMin !== undefined || query.priceMax !== undefined) {
      const currency = query.priceCurrency ?? 'INR';
      where.currency = currency;
      if (query.priceMin !== undefined) where.targetPriceMin = { gte: query.priceMin };
      if (query.priceMax !== undefined) where.targetPriceMax = { lte: query.priceMax };
    }

    // Always compute new-since-last-login count (for badge, regardless of filters)
    const lastLogin = seller.user?.lastLoginAt;
    const newSinceLastLoginPromise = lastLogin
      ? this.prisma.buyLead.count({ where: { isOpen: true, deletedAt: null, createdAt: { gte: lastLogin } } })
      : Promise.resolve(0);

    const [total, leads, newSinceLastLogin] = await Promise.all([
      this.prisma.buyLead.count({ where }),
      this.prisma.buyLead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { buyer: { select: { gstinNumber: true } } },
      }),
      newSinceLastLoginPromise,
    ]);

    const result = {
      leads: leads.map((l) => this.maskLead(l)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      newSinceLastLogin,
    };

    await this.redis.set(ck, result, 300);
    return result;
  }

  // ─── New leads count since seller's last login ────────────────────────────

  async getNewLeadsCount(userId: string) {
    const seller = await this.getVerifiedSeller(userId);
    const lastLogin = seller.user?.lastLoginAt;

    if (!lastLogin) return { count: 0, lastLoginAt: null };

    const count = await this.prisma.buyLead.count({
      where: { isOpen: true, deletedAt: null, createdAt: { gte: lastLogin } },
    });

    return { count, lastLoginAt: lastLogin };
  }

  // ─── Active categories (have ≥ 1 open buy lead) ───────────────────────────

  async getActiveCategories() {
    const leads = await this.prisma.buyLead.findMany({
      where: { isOpen: true, deletedAt: null, categoryId: { not: null } },
      select: { categoryId: true },
      distinct: ['categoryId'],
    });

    const categoryIds = leads.map((l) => l.categoryId).filter(Boolean) as string[];
    if (categoryIds.length === 0) return [];

    return this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, parentId: true },
      orderBy: { name: 'asc' },
    });
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
      if (err?.code === 'P2025') {
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

    // Collect category IDs AND product names from seller's APPROVED active products
    const products = await this.prisma.product.findMany({
      where: { sellerId: seller.id, adminApprovalStatus: 'APPROVED', isActive: true },
      select: { name: true, categories: { select: { categoryId: true } } },
    });

    if (products.length === 0) {
      return { leads: [], total: 0, page, limit, totalPages: 0, hasCategories: false };
    }

    const categoryIds = [
      ...new Set(products.flatMap((p) => p.categories.map((c) => c.categoryId))),
    ];

    // Extract keywords from product names (min 3 chars, skip generic stop words)
    const STOP = new Set(['and', 'the', 'for', 'with', 'from', 'per', 'set', 'box', 'pack', 'lot', 'each', 'new']);
    const nameKeywords = [
      ...new Set(
        products.flatMap((p) =>
          p.name
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length >= 3 && !STOP.has(w)),
        ),
      ),
    ];
    // Wrap each keyword as a LIKE pattern
    const namePatterns = nameKeywords.map((k) => `%${k}%`);

    const cacheKey = `seller:leads:${seller.id}:${page}:${limit}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return { ...cached, fromCache: true };

    const now = new Date();
    const skip = (page - 1) * limit;

    type RawLead = {
      id: string; productName: string; quantity: any; unit: string | null;
      quantityRequired: number | null; expectedCountry: string | null;
      contactChannel: string; repeatOption: string; isOpen: boolean;
      createdAt: Date; expiryDate: Date | null; expiresAt: Date | null;
      categoryId: string | null;
    };

    // Match by category (exact) OR product name keyword (ILIKE ANY)
    const categoryClause = categoryIds.length > 0
      ? Prisma.sql`"categoryId" = ANY(${categoryIds}::text[])`
      : Prisma.sql`FALSE`;

    const nameClause = namePatterns.length > 0
      ? Prisma.sql`"productName" ILIKE ANY(${namePatterns}::text[])`
      : Prisma.sql`FALSE`;

    const baseWhere = Prisma.sql`
      (${categoryClause} OR ${nameClause})
      AND "isOpen" = true
      AND "deletedAt" IS NULL
      AND ("expiryDate" IS NULL OR "expiryDate" > ${now})
    `;

    const [countResult, leads] = await Promise.all([
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) AS count FROM "BuyLead" WHERE ${baseWhere}
      `,
      this.prisma.$queryRaw<RawLead[]>`
        SELECT id, "productName", quantity, unit, "quantityRequired",
               "expectedCountry", "contactChannel", "repeatOption",
               "isOpen", "createdAt", "expiryDate", "expiresAt", "categoryId"
        FROM "BuyLead"
        WHERE ${baseWhere}
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

  // ─── Submit a quote against a revealed buy lead ───────────────────────────

  async submitQuote(userId: string, leadId: string, dto: SubmitQuoteDto) {
    const seller = await this.getVerifiedSeller(userId);

    // Seller must have revealed this lead first
    const reveal = await this.prisma.leadContactReveal.findFirst({
      where: { sellerId: seller.id, buyLeadId: leadId },
    });
    if (!reveal) {
      throw new ForbiddenException('Reveal the lead contact before submitting a quote.');
    }

    const lead = await this.prisma.buyLead.findFirst({
      where: { id: leadId, isOpen: true, deletedAt: null },
      include: { buyer: { select: { id: true, userId: true } } },
    });
    if (!lead) throw new NotFoundException('Buy lead not found or is no longer open.');

    // Prevent duplicate PENDING quotes from the same seller on the same lead
    const existing = await this.prisma.quote.findFirst({
      where: { sellerId: seller.id, buyLeadId: leadId, status: 'PENDING' },
    });
    if (existing) {
      throw new BadRequestException('You already have a pending quote for this lead.');
    }

    const expiresAt = new Date(Date.now() + (dto.validDays ?? 7) * 24 * 3600 * 1000);

    // Create order (QUOTED status) then attach the quote record
    const order = await this.prisma.order.create({
      data: {
        buyerId: lead.buyer.id,
        sellerId: seller.id,
        productId: dto.productId ?? null,
        status: 'QUOTED' as any,
        quotedPrice: dto.quotedPrice,
      },
    });

    const quote = await this.prisma.quote.create({
      data: {
        orderId: order.id,
        sellerId: seller.id,
        buyLeadId: leadId,
        productId: dto.productId ?? null,
        quotedPrice: dto.quotedPrice,
        leadTime: dto.leadTime ?? null,
        notes: dto.notes ?? null,
        expiresAt,
      },
      select: { id: true, quotedPrice: true, leadTime: true, notes: true, expiresAt: true, status: true },
    });

    // Auto-mark reveal as converted
    await this.prisma.leadContactReveal.update({
      where: { id: reveal.id },
      data: { convertedToOrder: true, convertedAt: new Date() },
    }).catch(() => undefined);

    // Notify buyer
    await this.prisma.notification.create({
      data: {
        userId: lead.buyer.userId,
        type: 'QUOTE_RECEIVED',
        title: `New quote for "${lead.productName}"`,
        body: `${seller.companyName} has sent you a quote of ₹${dto.quotedPrice.toLocaleString('en-IN')}`,
        isRead: false,
        metadata: { quoteId: quote.id, leadId },
      },
    }).catch(() => undefined);

    this.notificationsQueue.add('quote-received', {
      buyerUserId: lead.buyer.userId,
      sellerName: seller.companyName,
      productName: lead.productName,
      quotedPrice: dto.quotedPrice,
      quoteId: quote.id,
      requestId: uuidv4(),
    }).catch(() => undefined);

    return { quoteId: quote.id, orderId: order.id, ...quote };
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
