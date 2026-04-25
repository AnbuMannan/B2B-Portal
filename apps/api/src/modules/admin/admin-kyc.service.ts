import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import { GstinService } from '../../services/government/gstin.service';
import { PanService } from '../../services/government/pan.service';
import { IecService } from '../../services/government/iec.service';
import { RejectKycDto } from './dto/reject-kyc.dto';

const SLA_HOURS = 48;
const SLA_WARNING_HOURS = 42;

@Injectable()
export class AdminKycService {
  private readonly logger = new Logger(AdminKycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly gstinService: GstinService,
    private readonly panService: PanService,
    private readonly iecService: IecService,
    @InjectQueue('notifications') private readonly notifQueue: Queue,
  ) {}

  async getStats() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [pending, approvedToday, rejectedToday, slaBreaches] = await Promise.all([
      this.prisma.seller.count({ where: { kycStatus: 'PENDING', deletedAt: null } }),
      this.prisma.seller.count({
        where: { kycStatus: 'APPROVED', approvalDate: { gte: startOfDay } },
      }),
      this.prisma.seller.count({
        where: {
          kycStatus: 'REJECTED',
          updatedAt: { gte: startOfDay },
        },
      }),
      this.prisma.seller.count({
        where: {
          kycStatus: 'PENDING',
          updatedAt: { lt: new Date(Date.now() - SLA_HOURS * 3600 * 1000) },
          deletedAt: null,
        },
      }),
    ]);

    // avg review time: hours between updatedAt of APPROVED sellers (today) and their submission
    // simplified: we don't have a submittedAt field, so approximate with (approvalDate - createdAt)
    const approvedRecent = await this.prisma.seller.findMany({
      where: { kycStatus: 'APPROVED', approvalDate: { not: null } },
      select: { createdAt: true, approvalDate: true },
      take: 100,
      orderBy: { approvalDate: 'desc' },
    });

    let avgReviewTime = 0;
    if (approvedRecent.length > 0) {
      const totalHours = approvedRecent.reduce((acc, s) => {
        const diff = (s.approvalDate!.getTime() - s.createdAt.getTime()) / 3600000;
        return acc + diff;
      }, 0);
      avgReviewTime = Math.round(totalHours / approvedRecent.length);
    }

    return { pending, approvedToday, rejectedToday, avgReviewTime, slaBreaches };
  }

  async getQueue() {
    const sellers = await this.prisma.seller.findMany({
      where: { kycStatus: 'PENDING', deletedAt: null },
      orderBy: { updatedAt: 'asc' }, // FIFO — oldest first
      select: {
        id: true,
        companyName: true,
        companyType: true,
        state: true,
        city: true,
        gstNumber: true,
        panNumber: true,
        iecCode: true,
        hasIEC: true,
        updatedAt: true,
        createdAt: true,
        user: { select: { email: true, phoneNumber: true } },
      },
    });

    const now = Date.now();
    return sellers.map((s) => {
      const elapsedHours = (now - s.updatedAt.getTime()) / 3600000;
      const hoursRemaining = Math.max(0, SLA_HOURS - elapsedHours);
      let slaStatus: 'GREEN' | 'YELLOW' | 'RED';
      if (elapsedHours < 24) slaStatus = 'GREEN';
      else if (elapsedHours < SLA_WARNING_HOURS) slaStatus = 'YELLOW';
      else slaStatus = 'RED';

      return { ...s, elapsedHours: Math.round(elapsedHours), hoursRemaining: Math.round(hoursRemaining), slaStatus };
    });
  }

  async getDetail(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      include: {
        user: { select: { id: true, email: true, phoneNumber: true, createdAt: true } },
        kycDocuments: true,
      },
    });

    if (!seller) throw new NotFoundException('Seller not found');

    // Run gov API checks in parallel (non-blocking)
    const [gstinResult, panResult, iecResult] = await Promise.all([
      seller.gstNumber
        ? this.gstinService.verify(seller.gstNumber)
        : Promise.resolve(null),
      seller.panNumber
        ? this.panService.verify(seller.panNumber)
        : Promise.resolve(null),
      seller.iecCode
        ? this.iecService.verify(seller.iecCode)
        : Promise.resolve(null),
    ]);

    const now = Date.now();
    const elapsedHours = (now - seller.updatedAt.getTime()) / 3600000;
    const hoursRemaining = Math.max(0, SLA_HOURS - elapsedHours);

    // Parse JSON address fields
    let registeredAddress: any = null;
    let businessAddress: any = null;
    try {
      if (seller.registeredOfficeAddress) registeredAddress = JSON.parse(seller.registeredOfficeAddress);
    } catch { /* noop */ }
    try {
      if (seller.businessOfficeAddress) businessAddress = JSON.parse(seller.businessOfficeAddress);
    } catch { /* noop */ }

    return {
      ...seller,
      registeredAddress,
      businessAddress,
      govApiResults: { gstin: gstinResult, pan: panResult, iec: iecResult },
      sla: {
        elapsedHours: Math.round(elapsedHours),
        hoursRemaining: Math.round(hoursRemaining),
        deadline: new Date(seller.updatedAt.getTime() + SLA_HOURS * 3600000),
      },
    };
  }

  async approveKyc(sellerId: string, adminUserId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: { id: true, companyName: true, kycStatus: true, userId: true },
    });

    if (!seller) throw new NotFoundException('Seller not found');
    if (seller.kycStatus === 'APPROVED') throw new ConflictException('KYC already approved');
    if (seller.kycStatus !== 'PENDING') {
      throw new BadRequestException(`Cannot approve KYC with status: ${seller.kycStatus}`);
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // 1. Approve seller
      await tx.seller.update({
        where: { id: sellerId },
        data: { kycStatus: 'APPROVED', isVerified: true, approvalDate: now },
      });

      // 2. Admin approval record
      await tx.adminApproval.create({
        data: {
          adminId: adminUserId,
          entityType: 'SELLER_KYC',
          entityId: sellerId,
          status: 'APPROVED',
          reviewedAt: now,
          reviewNotes: 'KYC documents verified and approved',
        },
      });

      // 3. Create lead credit wallet (0 balance) if not existing
      const existing = await tx.leadCreditWallet.findUnique({ where: { sellerId } });
      if (!existing) {
        await tx.leadCreditWallet.create({
          data: { sellerId, balance: 0 },
        });
      }

      // 4. Audit log — inside tx so it rolls back if approval fails
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          entityType: 'SELLER_KYC',
          entityId: sellerId,
          action: 'UPDATE',
          oldValue: JSON.stringify({ status: 'PENDING' }),
          newValue: JSON.stringify({ status: 'APPROVED', companyName: seller.companyName, reviewedAt: now }),
          timestamp: now,
          createdAt: now,
        },
      });
    });

    // Notify seller — fire-and-forget (intentionally outside tx; a queue failure must not roll back approval)
    this.notifQueue.add('kyc-approved', {
      userId: seller.userId,
      sellerId,
      type: 'EMAIL',
      templateId: 'kyc-approved',
      data: { companyName: seller.companyName },
      requestId: uuidv4(),
    }).catch((e) => this.logger.warn(`KYC approval notification failed: ${e.message}`));

    this.logger.log(`KYC approved: seller ${sellerId} by admin ${adminUserId}`);
    return { sellerId, status: 'APPROVED' };
  }

  async rejectKyc(sellerId: string, adminUserId: string, dto: RejectKycDto) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: { id: true, companyName: true, kycStatus: true, userId: true },
    });

    if (!seller) throw new NotFoundException('Seller not found');
    if (seller.kycStatus === 'REJECTED') throw new ConflictException('KYC already rejected');
    if (seller.kycStatus !== 'PENDING') {
      throw new BadRequestException(`Cannot reject KYC with status: ${seller.kycStatus}`);
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.seller.update({
        where: { id: sellerId },
        data: { kycStatus: 'REJECTED', rejectionReason: dto.rejectionReason },
      });

      await tx.adminApproval.create({
        data: {
          adminId: adminUserId,
          entityType: 'SELLER_KYC',
          entityId: sellerId,
          status: 'REJECTED',
          reviewedAt: now,
          reviewNotes: dto.rejectionReason,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          entityType: 'SELLER_KYC',
          entityId: sellerId,
          action: 'UPDATE',
          oldValue: JSON.stringify({ status: 'PENDING' }),
          newValue: JSON.stringify({ status: 'REJECTED', reason: dto.rejectionReason }),
          timestamp: now,
          createdAt: now,
        },
      });
    });

    this.notifQueue.add('kyc-rejected', {
      userId: seller.userId,
      sellerId,
      type: 'EMAIL',
      templateId: 'kyc-rejected',
      data: { companyName: seller.companyName, reason: dto.rejectionReason },
      requestId: uuidv4(),
    }).catch((e) => this.logger.warn(`KYC rejection notification failed: ${e.message}`));

    this.logger.log(`KYC rejected: seller ${sellerId} by admin ${adminUserId}`);
    return { sellerId, status: 'REJECTED', reason: dto.rejectionReason };
  }

  // Hourly SLA monitor — warns at 42h, escalates at 48h
  @Cron('0 * * * *')
  async monitorSla() {
    const now = new Date();
    const warningThreshold = new Date(now.getTime() - SLA_WARNING_HOURS * 3600000);
    const breachThreshold = new Date(now.getTime() - SLA_HOURS * 3600000);

    const warningSellers = await this.prisma.seller.findMany({
      where: {
        kycStatus: 'PENDING',
        updatedAt: { lt: warningThreshold, gte: breachThreshold },
        deletedAt: null,
      },
      select: { id: true, companyName: true, updatedAt: true },
    });

    const breachSellers = await this.prisma.seller.findMany({
      where: {
        kycStatus: 'PENDING',
        updatedAt: { lt: breachThreshold },
        deletedAt: null,
      },
      select: { id: true, companyName: true, updatedAt: true },
    });

    if (warningSellers.length > 0) {
      this.logger.warn(
        `SLA WARNING: ${warningSellers.length} KYC applications within 6h of SLA breach: ${warningSellers.map((s) => s.id).join(', ')}`,
      );
      this.notifQueue.add('admin-sla-warning', {
        type: 'EMAIL',
        templateId: 'kyc-sla-warning',
        data: { sellers: warningSellers },
        requestId: uuidv4(),
      }).catch(() => { /* noop */ });
    }

    if (breachSellers.length > 0) {
      this.logger.error(
        `SLA BREACH: ${breachSellers.length} KYC applications exceeded 48h SLA: ${breachSellers.map((s) => s.id).join(', ')}`,
      );
      this.notifQueue.add('admin-sla-breach', {
        type: 'EMAIL',
        templateId: 'kyc-sla-breach',
        data: { sellers: breachSellers },
        requestId: uuidv4(),
      }).catch(() => { /* noop */ });
    }
  }
}
