import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
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
    const seller = await this.getVerifiedSeller(userId);

    // KYC must be approved
    if (seller.kycStatus !== 'APPROVED') {
      throw new ForbiddenException('Your KYC must be approved before revealing contacts.');
    }

    // Idempotency: already revealed?
    const existing = await this.prisma.leadContactReveal.findFirst({
      where: { sellerId: seller.id, buyLeadId: leadId },
    });
    if (existing) {
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

    // Encrypt buyer contact from User record
    const buyerUser = lead.buyer.user;
    const phone = buyerUser.phoneNumber ?? '';
    const encryptedContact = this.encryptionUtil.encryptLeadContact({
      buyerPhoneNumber: phone,
      buyerEmail: buyerUser.email,
      buyerWhatsapp: phone,
    });

    const referenceId = `lead-reveal:${leadId}:${seller.id}`;

    // Atomic transaction: deduct credit + record reveal
    const reveal = await this.prisma.$transaction(async (tx) => {
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
          buyerPhoneNumber: encryptedContact.buyerPhoneNumber,
          buyerEmail: encryptedContact.buyerEmail,
          buyerWhatsapp: encryptedContact.buyerWhatsapp,
          buyerGstin: lead.buyer.gstinNumber ?? null,
          creditDeducted: true,
        },
      });
    });

    this.logger.log(`Seller ${seller.id} revealed lead ${leadId}`);
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
}
