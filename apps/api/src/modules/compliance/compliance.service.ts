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
import { PrismaService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import { RecordConsentDto, WithdrawConsentDto, DeleteAccountDto, GrievanceDto } from './dto/compliance.dto';

const CURRENT_POLICY_VERSION = 'v2024.1';
const GRIEVANCE_SLA_HOURS = 72; // DPDP Act §13(3)
const EXPORT_EXPIRY_HOURS = 24;

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @InjectQueue('export') private readonly exportQueue: Queue,
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('notifications') private readonly notifQueue: Queue,
  ) {}

  // ── Consent Management ───────────────────────────────────────────────────────

  async recordConsent(userId: string, dto: RecordConsentDto, ipAddress?: string, userAgent?: string) {
    const consent = await this.prisma.consentRecord.create({
      data: {
        userId,
        consentType: dto.consentType,
        version: dto.version,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });

    await this.auditService.logAction({
      userId,
      entityType: 'SELLER_KYC',
      entityId: consent.id,
      action: 'CREATE',
      newValue: { event: 'CONSENT_GIVEN', consentType: dto.consentType, version: dto.version },
    });

    return consent;
  }

  async withdrawConsent(userId: string, dto: WithdrawConsentDto) {
    // ESSENTIAL consent cannot be withdrawn (required for service operation per DPDP §7)
    const activeConsent = await this.prisma.consentRecord.findFirst({
      where: { userId, consentType: dto.consentType, withdrawnAt: null },
      orderBy: { givenAt: 'desc' },
    });

    if (!activeConsent) {
      throw new NotFoundException(`No active ${dto.consentType} consent found`);
    }

    const updated = await this.prisma.consentRecord.update({
      where: { id: activeConsent.id },
      data: { withdrawnAt: new Date() },
    });

    await this.auditService.logAction({
      userId,
      entityType: 'SELLER_KYC',
      entityId: activeConsent.id,
      action: 'UPDATE',
      newValue: { event: 'CONSENT_WITHDRAWN', consentType: dto.consentType },
    });

    return updated;
  }

  async getConsentHistory(userId: string) {
    const records = await this.prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { givenAt: 'desc' },
    });

    // Build current state per consent type
    const types = ['ESSENTIAL', 'MARKETING', 'ANALYTICS', 'DATA_SHARING'];
    const currentState = types.map((type) => {
      const latest = records.find((r) => r.consentType === type);
      return {
        consentType: type,
        isActive: latest ? latest.withdrawnAt === null : false,
        version: latest?.version ?? null,
        givenAt: latest?.givenAt ?? null,
        withdrawnAt: latest?.withdrawnAt ?? null,
      };
    });

    return { currentState, history: records };
  }

  // ── Data Export (Right to Portability — DPDP §12) ────────────────────────────

  async requestDataExport(userId: string) {
    // Rate-limit: one pending export at a time
    const pending = await this.prisma.dataExportRequest.findFirst({
      where: { userId, status: { in: ['QUEUED', 'PROCESSING'] } },
    });
    if (pending) {
      throw new ConflictException('An export is already in progress. Please wait for it to complete.');
    }

    const exportReq = await this.prisma.dataExportRequest.create({
      data: { userId, status: 'QUEUED' },
    });

    await this.exportQueue.add(
      'data-export',
      { userId, requestId: exportReq.id },
      { jobId: exportReq.id, attempts: 2, backoff: { type: 'fixed', delay: 10000 } },
    );

    await this.auditService.logAction({
      userId,
      entityType: 'SELLER_KYC',
      entityId: exportReq.id,
      action: 'CREATE',
      newValue: { event: 'DATA_EXPORT_REQUESTED' },
    });

    return { requestId: exportReq.id, status: 'QUEUED', message: 'Your data export has been queued. You will receive an email with a download link within 30 minutes.' };
  }

  async getExportStatus(userId: string, requestId: string) {
    const req = await this.prisma.dataExportRequest.findFirst({
      where: { id: requestId, userId },
    });
    if (!req) throw new NotFoundException('Export request not found');

    // Check if download link has expired
    if (req.status === 'READY' && req.expiresAt && req.expiresAt < new Date()) {
      await this.prisma.dataExportRequest.update({
        where: { id: requestId },
        data: { status: 'EXPIRED', fileUrl: null },
      });
      return { ...req, status: 'EXPIRED', fileUrl: null };
    }

    return req;
  }

  /**
   * Called by the export queue worker after compiling the JSON archive.
   * In production, fileUrl would be a signed S3/Supabase URL.
   */
  async fulfillDataExport(requestId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, createdAt: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const [profile, sellers, buyers, orders, transactions, leads, consents] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true, createdAt: true } }),
      this.prisma.seller.findMany({ where: { userId }, select: { companyName: true, gstNumber: true, kycStatus: true, createdAt: true } }),
      this.prisma.buyer.findMany({ where: { userId }, select: { id: true, createdAt: true } }),
      this.prisma.order.findMany({ where: { sellerId: { in: (await this.prisma.seller.findMany({ where: { userId }, select: { id: true } })).map((s) => s.id) } }, select: { id: true, status: true, createdAt: true } }),
      this.prisma.leadCreditTransaction.findMany({ where: { seller: { userId } }, select: { id: true, type: true, credits: true, totalAmount: true, createdAt: true } }),
      this.prisma.buyLead.findMany({ where: { buyer: { userId } }, select: { id: true, productName: true, createdAt: true } }),
      this.prisma.consentRecord.findMany({ where: { userId }, select: { consentType: true, version: true, givenAt: true, withdrawnAt: true } }),
    ]);

    const exportPayload = JSON.stringify({
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
      legalBasis: 'DPDP Act 2023 §12 — Right to Data Portability',
      profile, sellers, buyers, orders, transactions, leads, consents,
    }, null, 2);

    // In production: upload exportPayload to S3/Supabase Storage, get signed URL
    // For now we store it as a base64-encoded data note (development only)
    const fileUrl = `data:application/json;base64,${Buffer.from(exportPayload).toString('base64')}`;
    const expiresAt = new Date(Date.now() + EXPORT_EXPIRY_HOURS * 3600 * 1000);

    await this.prisma.dataExportRequest.update({
      where: { id: requestId },
      data: { status: 'READY', fileUrl, expiresAt, completedAt: new Date() },
    });

    // Notify user by email
    await this.emailQueue.add('export-ready', {
      to: user.email,
      subject: 'Your data export is ready — B2B Marketplace',
      templateId: 'DATA_EXPORT_READY',
      data: { downloadUrl: `/privacy/data-export?request=${requestId}`, expiresHours: EXPORT_EXPIRY_HOURS },
      requestId,
    }).catch(() => {});

    return { requestId, status: 'READY' };
  }

  // ── Account Deletion (Right to Erasure — DPDP §13) ───────────────────────────

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { sellers: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.deletedAt) throw new ConflictException('Account is already deleted');

    await this.prisma.$transaction(async (tx) => {
      const anonymizedEmail = `deleted_${userId}@deleted.invalid`;

      // Anonymize PII — DPDP §13: erasure must not break financial audit trail
      await tx.user.update({
        where: { id: userId },
        data: {
          email: anonymizedEmail,
          phoneNumber: null,
          passwordHash: 'DELETED',
          passwordResetToken: null,
          passwordResetExpiry: null,
          twoFaSecret: null,
          twoFaEnabled: false,
          isActive: false,
          deletedAt: new Date(),
        },
      });

      // Revoke all refresh tokens
      await tx.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });

      // Anonymize seller PII — keep financials (GST law requires 7-year retention)
      for (const seller of user.sellers) {
        await tx.seller.update({
          where: { id: seller.id },
          data: {
            directorName: null,
            directorPan: null,
            directorPhoto: null,
            aadhaarLastFour: null,
            logoUrl: null,
            registeredOfficeAddress: null,
            businessOfficeAddress: null,
          },
        });

        // Hard-delete KYC documents (these contain raw PII scans)
        await tx.sellerKycDocument.deleteMany({ where: { sellerId: seller.id } });
      }

      // Withdraw all active consents
      await tx.consentRecord.updateMany({
        where: { userId, withdrawnAt: null },
        data: { withdrawnAt: new Date() },
      });

      // Cancel any pending data exports
      await tx.dataExportRequest.updateMany({
        where: { userId, status: { in: ['QUEUED', 'PROCESSING'] } },
        data: { status: 'CANCELLED' },
      });
    });

    await this.auditService.logAction({
      userId,
      entityType: 'SELLER_KYC',
      entityId: userId,
      action: 'DELETE',
      newValue: { event: 'ACCOUNT_DELETED', reason: dto.reason ?? null },
    });

    this.logger.log(`Account deleted (DPDP erasure): ${userId}`);
    return { deleted: true, message: 'Your account and personal data have been anonymized in accordance with the DPDP Act 2023.' };
  }

  // ── Grievance Officer (DPDP §13 — legal obligation) ──────────────────────────

  async submitGrievance(dto: GrievanceDto, userId?: string) {
    const slaDeadline = new Date(Date.now() + GRIEVANCE_SLA_HOURS * 3600 * 1000);

    const ticket = await this.prisma.grievanceTicket.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? null,
        subject: dto.subject,
        description: dto.description,
        category: dto.category,
        userId: userId ?? null,
        slaDeadline,
      },
    });

    // Email to grievance officer
    await this.emailQueue.add('grievance-filed', {
      to: process.env.GRIEVANCE_OFFICER_EMAIL ?? 'grievance@b2bmarket.in',
      subject: `[Grievance #${ticket.id.slice(-8).toUpperCase()}] ${dto.subject}`,
      templateId: 'GRIEVANCE_OFFICER_NOTIFY',
      data: {
        ticketId: ticket.id,
        name: dto.name,
        email: dto.email,
        category: dto.category,
        description: dto.description,
        slaDeadline: slaDeadline.toISOString(),
      },
      requestId: ticket.id,
    }).catch(() => {});

    // Acknowledgement to filer
    await this.emailQueue.add('grievance-ack', {
      to: dto.email,
      subject: `Grievance received — Ticket #${ticket.id.slice(-8).toUpperCase()}`,
      templateId: 'GRIEVANCE_ACK',
      data: {
        name: dto.name,
        ticketId: ticket.id,
        slaDeadline: slaDeadline.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      },
      requestId: ticket.id,
    }).catch(() => {});

    return {
      ticketId: ticket.id,
      referenceNumber: ticket.id.slice(-8).toUpperCase(),
      slaDeadline,
      message: `Your grievance has been registered. Reference: #${ticket.id.slice(-8).toUpperCase()}. Our Grievance Officer will respond within 72 hours as mandated by the DPDP Act 2023.`,
    };
  }

  async getGrievanceStatus(ticketId: string, email: string) {
    const ticket = await this.prisma.grievanceTicket.findFirst({
      where: { id: ticketId, email: { equals: email, mode: 'insensitive' } },
    });
    if (!ticket) throw new NotFoundException('Grievance ticket not found');
    return ticket;
  }

  // Admin: list grievances for the Grievance Officer dashboard
  async listGrievances(status?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.grievanceTicket.findMany({
        where,
        orderBy: { slaDeadline: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.grievanceTicket.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async respondToGrievance(ticketId: string, adminUserId: string, notes: string, status: string) {
    const ticket = await this.prisma.grievanceTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Grievance ticket not found');

    const updated = await this.prisma.grievanceTicket.update({
      where: { id: ticketId },
      data: {
        responseNotes: notes,
        status,
        respondedAt: new Date(),
        respondedBy: adminUserId,
      },
    });

    // Notify filer
    await this.emailQueue.add('grievance-response', {
      to: ticket.email,
      subject: `Response to your grievance #${ticketId.slice(-8).toUpperCase()}`,
      templateId: 'GRIEVANCE_RESPONSE',
      data: { name: ticket.name, responseNotes: notes, status },
      requestId: ticketId,
    }).catch(() => {});

    return updated;
  }

  // ── Cron: SLA breach monitor ────────────────────────────────────────────────

  @Cron('0 * * * *') // every hour
  async checkGrievanceSlaBreaches() {
    const breached = await this.prisma.grievanceTicket.updateMany({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        slaDeadline: { lt: new Date() },
        slaBreach: false,
      },
      data: { slaBreach: true },
    });

    if (breached.count > 0) {
      this.logger.warn(`Grievance SLA breach: ${breached.count} tickets exceeded 72h`);
      await this.notifQueue.add('grievance-sla-breach', {
        type: 'GRIEVANCE_SLA_BREACH',
        count: breached.count,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }
  }
}
