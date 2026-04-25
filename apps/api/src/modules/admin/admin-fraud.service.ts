import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import { BlockUserDto, UnblockUserDto } from './dto/fraud.dto';

// Fraud detection thresholds
const BULK_LEAD_THRESHOLD = 10;       // leads per day from same buyer
const REPEAT_LEAD_WINDOW_HOURS = 1;   // hours for repeated product detection
const REPEAT_LEAD_MIN_COUNT = 3;      // same product name in window = suspicious

interface FraudIndicator {
  rule: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  detail: string;
}

interface SuspiciousAccount {
  userId: string;
  email: string;
  phoneNumber: string | null;
  isActive: boolean;
  createdAt: Date;
  role: string;
  indicators: FraudIndicator[];
  riskScore: number;
  isBlocked: boolean;
}

@Injectable()
export class AdminFraudService {
  private readonly logger = new Logger(AdminFraudService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ── Fraud detection ───────────────────────────────────────────────────────

  async getSuspiciousAccounts(): Promise<SuspiciousAccount[]> {
    const [
      duplicatePhoneUsers,
      duplicateEmailUsers,
      bulkLeadBuyers,
      repeatLeadBuyers,
      blockedUserIds,
    ] = await Promise.all([
      this.findDuplicatePhoneAccounts(),
      this.findDuplicateEmailPatterns(),
      this.findBulkLeadPosters(),
      this.findRepeatLeadPosters(),
      this.getBlockedUserIdSet(),
    ]);

    // Merge all findings into a map keyed by userId
    const suspiciousMap = new Map<string, SuspiciousAccount>();

    const mergeUser = async (userId: string, indicator: FraudIndicator) => {
      if (!suspiciousMap.has(userId)) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, phoneNumber: true, isActive: true, createdAt: true, role: true },
        });
        if (!user) return;
        suspiciousMap.set(userId, {
          userId: user.id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          isActive: user.isActive,
          createdAt: user.createdAt,
          role: user.role,
          indicators: [],
          riskScore: 0,
          isBlocked: blockedUserIds.has(userId),
        });
      }
      const entry = suspiciousMap.get(userId)!;
      entry.indicators.push(indicator);
      entry.riskScore += indicator.severity === 'HIGH' ? 30 : indicator.severity === 'MEDIUM' ? 15 : 5;
    };

    for (const { userId, phoneNumber, count } of duplicatePhoneUsers) {
      await mergeUser(userId, {
        rule: 'DUPLICATE_PHONE',
        severity: 'HIGH',
        detail: `Phone ${phoneNumber} shared across ${count} accounts`,
      });
    }

    for (const { userId, emailDomain, count } of duplicateEmailUsers) {
      await mergeUser(userId, {
        rule: 'SUSPICIOUS_EMAIL_PATTERN',
        severity: 'MEDIUM',
        detail: `Domain ${emailDomain} used for ${count} accounts`,
      });
    }

    for (const { userId, leadsToday } of bulkLeadBuyers) {
      await mergeUser(userId, {
        rule: 'BULK_LEAD_POSTING',
        severity: 'HIGH',
        detail: `${leadsToday} leads posted in the last 24h (threshold: ${BULK_LEAD_THRESHOLD})`,
      });
    }

    for (const { userId, productName, count } of repeatLeadBuyers) {
      await mergeUser(userId, {
        rule: 'REPEATED_PRODUCT_LEAD',
        severity: 'MEDIUM',
        detail: `"${productName}" posted ${count} times within ${REPEAT_LEAD_WINDOW_HOURS}h`,
      });
    }

    return Array.from(suspiciousMap.values())
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  private async findDuplicatePhoneAccounts() {
    // Users sharing the same non-null phone number
    const groups = await this.prisma.user.groupBy({
      by: ['phoneNumber'],
      where: { phoneNumber: { not: null }, role: 'BUYER' },
      having: { phoneNumber: { _count: { gt: 1 } } },
      _count: { phoneNumber: true },
    });

    const results: { userId: string; phoneNumber: string; count: number }[] = [];
    for (const g of groups) {
      const users = await this.prisma.user.findMany({
        where: { phoneNumber: g.phoneNumber },
        select: { id: true },
      });
      for (const u of users) {
        results.push({ userId: u.id, phoneNumber: g.phoneNumber!, count: g._count.phoneNumber });
      }
    }
    return results;
  }

  private async findDuplicateEmailPatterns() {
    // Multiple accounts from same email domain (> 5 accounts — spam pattern)
    const users = await this.prisma.user.findMany({
      where: { role: 'BUYER' },
      select: { id: true, email: true },
    });

    const domainMap = new Map<string, string[]>();
    for (const u of users) {
      const domain = u.email.split('@')[1]?.toLowerCase() ?? '';
      // Ignore common providers — only flag obscure/burner domains
      const commonProviders = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'rediffmail.com', 'yopmail.com'];
      if (commonProviders.includes(domain)) continue;
      if (!domainMap.has(domain)) domainMap.set(domain, []);
      domainMap.get(domain)!.push(u.id);
    }

    const results: { userId: string; emailDomain: string; count: number }[] = [];
    for (const [domain, userIds] of domainMap) {
      if (userIds.length > 5) {
        for (const uid of userIds) {
          results.push({ userId: uid, emailDomain: domain, count: userIds.length });
        }
      }
    }
    return results;
  }

  private async findBulkLeadPosters() {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const groups = await this.prisma.buyLead.groupBy({
      by: ['buyerId'],
      where: { createdAt: { gte: since }, deletedAt: null },
      _count: { id: true },
      having: { id: { _count: { gt: BULK_LEAD_THRESHOLD } } },
    });

    const results: { userId: string; leadsToday: number }[] = [];
    for (const g of groups) {
      const buyer = await this.prisma.buyer.findUnique({
        where: { id: g.buyerId },
        select: { userId: true },
      });
      if (buyer) results.push({ userId: buyer.userId, leadsToday: g._count.id });
    }
    return results;
  }

  private async findRepeatLeadPosters() {
    const since = new Date(Date.now() - REPEAT_LEAD_WINDOW_HOURS * 3600 * 1000);
    const recentLeads = await this.prisma.buyLead.findMany({
      where: { createdAt: { gte: since }, deletedAt: null },
      select: { buyerId: true, productName: true },
    });

    // Group by buyerId + productName
    const key = (buyerId: string, name: string) => `${buyerId}::${name.toLowerCase().trim()}`;
    const counts = new Map<string, number>();
    const buyerProductMap = new Map<string, { buyerId: string; productName: string }>();

    for (const lead of recentLeads) {
      const k = key(lead.buyerId, lead.productName);
      counts.set(k, (counts.get(k) ?? 0) + 1);
      buyerProductMap.set(k, { buyerId: lead.buyerId, productName: lead.productName });
    }

    const results: { userId: string; productName: string; count: number }[] = [];
    for (const [k, count] of counts) {
      if (count >= REPEAT_LEAD_MIN_COUNT) {
        const { buyerId, productName } = buyerProductMap.get(k)!;
        const buyer = await this.prisma.buyer.findUnique({
          where: { id: buyerId },
          select: { userId: true },
        });
        if (buyer) results.push({ userId: buyer.userId, productName, count });
      }
    }
    return results;
  }

  private async getBlockedUserIdSet(): Promise<Set<string>> {
    const blocked = await this.prisma.blockList.findMany({
      where: { isActive: true, userId: { not: null } },
      select: { userId: true },
    });
    return new Set(blocked.map((b) => b.userId!));
  }

  // ── Block / Unblock ───────────────────────────────────────────────────────

  async blockUser(dto: BlockUserDto, adminUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, email: true, phoneNumber: true, isActive: true, role: true },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') throw new BadRequestException('Cannot block admin accounts');

    const alreadyBlocked = await this.prisma.blockList.findFirst({
      where: { userId: dto.userId, isActive: true },
    });
    if (alreadyBlocked) throw new ConflictException('User is already blocked');

    await this.prisma.$transaction(async (tx) => {
      // Deactivate user account
      await tx.user.update({
        where: { id: dto.userId },
        data: { isActive: false },
      });

      // Add to block list
      await tx.blockList.create({
        data: {
          userId: dto.userId,
          email: user.email,
          phoneNumber: user.phoneNumber,
          reason: dto.reason,
          blockedBy: adminUserId,
          notes: dto.notes,
        },
      });

      // Admin approval record for audit trail
      await tx.adminApproval.create({
        data: {
          adminId: adminUserId,
          entityType: 'BUYER_FRAUD',
          entityId: dto.userId,
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewNotes: dto.reason,
        },
      });
    });

    await this.auditService.logAction({
      userId: adminUserId,
      entityType: 'BUYER_FRAUD',
      entityId: dto.userId,
      action: 'UPDATE',
      newValue: { action: 'BLOCKED', reason: dto.reason, email: user.email },
    });

    this.logger.log(`User blocked: ${dto.userId} (${user.email}) by admin ${adminUserId}`);
    return { userId: dto.userId, email: user.email, status: 'BLOCKED' };
  }

  async unblockUser(dto: UnblockUserDto, adminUserId: string) {
    const blockEntry = await this.prisma.blockList.findFirst({
      where: { userId: dto.userId, isActive: true },
    });

    if (!blockEntry) throw new NotFoundException('No active block found for this user');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: dto.userId },
        data: { isActive: true },
      });

      await tx.blockList.update({
        where: { id: blockEntry.id },
        data: { isActive: false, unblockedAt: new Date(), notes: dto.notes ?? blockEntry.notes },
      });
    });

    await this.auditService.logAction({
      userId: adminUserId,
      entityType: 'BUYER_FRAUD',
      entityId: dto.userId,
      action: 'UPDATE',
      newValue: { action: 'UNBLOCKED', notes: dto.notes },
    });

    this.logger.log(`User unblocked: ${dto.userId} by admin ${adminUserId}`);
    return { userId: dto.userId, status: 'UNBLOCKED' };
  }

  async getBlockList(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.blockList.findMany({
        where: { isActive: true },
        orderBy: { blockedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.blockList.count({ where: { isActive: true } }),
    ]);
    return { items, total, page, limit };
  }

  async getLeadsByState() {
    const leads = await this.prisma.buyLead.findMany({
      where: { deletedAt: null, deliveryState: { not: null } },
      select: { deliveryState: true },
    });

    const stateMap = new Map<string, number>();
    for (const l of leads) {
      if (l.deliveryState) {
        stateMap.set(l.deliveryState, (stateMap.get(l.deliveryState) ?? 0) + 1);
      }
    }

    return Array.from(stateMap.entries())
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count);
  }

  // ── Nightly cron: scan + auto-flag ────────────────────────────────────────

  @Cron('0 2 * * *') // 2 AM IST daily
  async runNightlyFraudScan() {
    this.logger.log('Nightly fraud scan started');
    try {
      const suspicious = await this.getSuspiciousAccounts();
      const highRisk = suspicious.filter((s) => s.riskScore >= 30 && s.isActive);

      for (const account of highRisk) {
        // Log to audit trail for admin review — do NOT auto-block; human review required
        await this.auditService.logAction({
          entityType: 'BUYER_FRAUD',
          entityId: account.userId,
          action: 'CREATE',
          newValue: {
            event: 'FRAUD_SCAN_HIGH_RISK',
            riskScore: account.riskScore,
            indicators: account.indicators.map((i) => i.rule),
            email: account.email,
          },
        });
      }

      this.logger.log(
        `Nightly fraud scan complete: ${suspicious.length} suspicious, ${highRisk.length} high-risk flagged for review`,
      );
    } catch (err) {
      this.logger.error('Nightly fraud scan failed', err);
    }
  }
}
