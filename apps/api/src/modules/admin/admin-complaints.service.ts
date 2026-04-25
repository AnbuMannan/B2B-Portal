import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';

const TICKET_SELECT = {
  id: true,
  subject: true,
  description: true,
  category: true,
  status: true,
  slaDeadline: true,
  slaBreach: true,
  adminNotes: true,
  orderId: true,
  escalatedAt: true,
  escalatedTo: true,
  escalatedBy: true,
  createdAt: true,
  resolvedAt: true,
  updatedAt: true,
  reporter: {
    select: { id: true, email: true, phoneNumber: true, role: true },
  },
  reportedUser: {
    select: { id: true, email: true, role: true },
  },
  responses: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      message: true,
      isInternal: true,
      createdAt: true,
      responder: { select: { id: true, email: true, adminRole: true } },
    },
  },
};

@Injectable()
export class AdminComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @InjectQueue('notifications') private readonly notifQueue: Queue,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {}

  // ── Stats ────────────────────────────────────────────────────────────────────

  async getStats() {
    const [open, inProgress, resolved, closed, slaBreaches, avgRaw] = await Promise.all([
      this.prisma.complaintTicket.count({ where: { status: 'OPEN', deletedAt: null } }),
      this.prisma.complaintTicket.count({ where: { status: 'IN_PROGRESS', deletedAt: null } }),
      this.prisma.complaintTicket.count({ where: { status: 'RESOLVED', deletedAt: null } }),
      this.prisma.complaintTicket.count({ where: { status: 'CLOSED', deletedAt: null } }),
      this.prisma.complaintTicket.count({ where: { slaBreach: true, status: { not: 'CLOSED' }, deletedAt: null } }),
      this.prisma.complaintTicket.findMany({
        where: { resolvedAt: { not: null }, deletedAt: null },
        select: { createdAt: true, resolvedAt: true },
        take: 200,
        orderBy: { resolvedAt: 'desc' },
      }),
    ]);

    let avgResolutionHours = 0;
    if (avgRaw.length > 0) {
      const totalMs = avgRaw.reduce((sum, t) => sum + (t.resolvedAt!.getTime() - t.createdAt.getTime()), 0);
      avgResolutionHours = Math.round(totalMs / avgRaw.length / 3600000 * 10) / 10;
    }

    return { open, inProgress, resolved, closed, slaBreaches, avgResolutionHours, total: open + inProgress + resolved + closed };
  }

  // ── List tickets ─────────────────────────────────────────────────────────────

  async listTickets(opts: {
    status?: string;
    category?: string;
    slaBreachOnly?: boolean;
    escalatedOnly?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, category, slaBreachOnly, escalatedOnly, search, page = 1, limit = 30 } = opts;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (category) where.category = category;
    if (slaBreachOnly) where.slaBreach = true;
    if (escalatedOnly) where.escalatedAt = { not: null };
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { reporter: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.complaintTicket.findMany({
        where,
        orderBy: [{ slaBreach: 'desc' }, { slaDeadline: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          subject: true,
          category: true,
          status: true,
          slaDeadline: true,
          slaBreach: true,
          escalatedAt: true,
          createdAt: true,
          resolvedAt: true,
          reporter: { select: { id: true, email: true, role: true } },
          reportedUser: { select: { id: true, email: true, role: true } },
          _count: { select: { responses: true } },
        },
      }),
      this.prisma.complaintTicket.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  // ── SLA breaches ─────────────────────────────────────────────────────────────

  async getSlaBreaches() {
    const items = await this.prisma.complaintTicket.findMany({
      where: { slaBreach: true, status: { in: ['OPEN', 'IN_PROGRESS'] }, deletedAt: null },
      orderBy: { slaDeadline: 'asc' },
      select: {
        id: true,
        subject: true,
        category: true,
        status: true,
        slaDeadline: true,
        escalatedAt: true,
        createdAt: true,
        reporter: { select: { id: true, email: true } },
        _count: { select: { responses: true } },
      },
    });

    return items.map((t) => ({
      ...t,
      hoursOverdue: Math.round((Date.now() - t.slaDeadline!.getTime()) / 3600000 * 10) / 10,
    }));
  }

  // ── Ticket detail ─────────────────────────────────────────────────────────────

  async getTicket(id: string) {
    const ticket = await this.prisma.complaintTicket.findFirst({
      where: { id, deletedAt: null },
      select: TICKET_SELECT,
    });
    if (!ticket) throw new NotFoundException('Complaint ticket not found');
    return ticket;
  }

  // ── Respond ───────────────────────────────────────────────────────────────────

  async respond(ticketId: string, adminId: string, dto: {
    message: string;
    status?: string;
    adminNotes?: string;
    isInternal?: boolean;
  }) {
    const ticket = await this.prisma.complaintTicket.findFirst({
      where: { id: ticketId, deletedAt: null },
      select: { id: true, status: true, reporterId: true, reporter: { select: { email: true } } },
    });
    if (!ticket) throw new NotFoundException('Complaint ticket not found');
    if (ticket.status === 'CLOSED') throw new BadRequestException('Cannot respond to a closed ticket');

    const newStatus = dto.status ?? ticket.status;

    const [, response] = await this.prisma.$transaction([
      this.prisma.complaintTicket.update({
        where: { id: ticketId },
        data: {
          status: newStatus as never,
          adminNotes: dto.adminNotes ?? undefined,
          resolvedAt: newStatus === 'RESOLVED' || newStatus === 'CLOSED' ? new Date() : undefined,
        },
      }),
      this.prisma.complaintTicketResponse.create({
        data: {
          ticketId,
          responderId: adminId,
          message: dto.message,
          isInternal: dto.isInternal ?? false,
        },
      }),
    ]);

    // Only notify complainant for non-internal responses
    if (!dto.isInternal) {
      await this.notifQueue.add('send-notification', {
        userId: ticket.reporterId,
        type: 'GENERAL',
        title: 'Update on your complaint',
        body: dto.message.slice(0, 120),
        link: `/buyer/complaints/${ticketId}`,
      }).catch(() => {});
    }

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'BUYER_FRAUD',
      entityId: ticketId,
      action: 'UPDATE',
      newValue: { event: 'COMPLAINT_RESPONSE', status: newStatus, isInternal: dto.isInternal },
    });

    return response;
  }

  // ── Escalate ──────────────────────────────────────────────────────────────────

  async escalate(ticketId: string, adminId: string, dto: { reason: string; escalateTo?: string }) {
    const ticket = await this.prisma.complaintTicket.findFirst({
      where: { id: ticketId, deletedAt: null },
      select: { id: true, status: true, escalatedAt: true, subject: true, reporterId: true },
    });
    if (!ticket) throw new NotFoundException('Complaint ticket not found');
    if (ticket.escalatedAt) throw new BadRequestException('Ticket is already escalated');

    await this.prisma.$transaction([
      this.prisma.complaintTicket.update({
        where: { id: ticketId },
        data: {
          escalatedAt: new Date(),
          escalatedBy: adminId,
          escalatedTo: dto.escalateTo ?? null,
          status: 'IN_PROGRESS',
        },
      }),
      // Record escalation as an internal note
      this.prisma.complaintTicketResponse.create({
        data: {
          ticketId,
          responderId: adminId,
          message: `⚠️ ESCALATED: ${dto.reason}`,
          isInternal: true,
        },
      }),
    ]);

    // Notify escalation target if specified
    if (dto.escalateTo) {
      await this.notifQueue.add('send-notification', {
        userId: dto.escalateTo,
        type: 'GENERAL',
        title: `Complaint escalated to you`,
        body: `Ticket "${ticket.subject}" requires senior review. Reason: ${dto.reason}`,
        link: `/admin/complaints?ticket=${ticketId}`,
      }).catch(() => {});
    }

    await this.auditService.logAction({
      userId: adminId,
      entityType: 'BUYER_FRAUD',
      entityId: ticketId,
      action: 'UPDATE',
      newValue: { event: 'COMPLAINT_ESCALATED', reason: dto.reason, escalateTo: dto.escalateTo },
    });

    return { ticketId, escalated: true };
  }
}
