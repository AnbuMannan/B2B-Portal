import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/database.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  AdminRespondDto,
  CreateComplaintDto,
  CreateGrievanceContactDto,
} from './dto/complaint.dto';

const SLA_HOURS = 48;

@Injectable()
export class ComplaintsService {
  private readonly logger = new Logger(ComplaintsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('notifications') private readonly notifQueue: Queue,
  ) {}

  // ── POST /api/complaints ───────────────────────────────────────────────────

  async createComplaint(reporterId: string, dto: CreateComplaintDto) {
    const slaDeadline = new Date(Date.now() + SLA_HOURS * 60 * 60 * 1000);

    const ticket = await (this.prisma as any).complaintTicket.create({
      data: {
        reporterId,
        reportedUserId: dto.reportedUserId,
        category: dto.category as any,
        subject: dto.subject,
        description: dto.description,
        attachments: dto.attachments ?? [],
        orderId: dto.orderId ?? null,
        slaDeadline,
        status: 'OPEN',
      },
      select: {
        id: true,
        subject: true,
        category: true,
        status: true,
        slaDeadline: true,
        createdAt: true,
        reporter: { select: { email: true } },
      },
    });

    // Acknowledgment email to complainant
    await this.emailQueue.add('complaint-ack', {
      to: ticket.reporter.email,
      subject: `Your complaint has been received — #${ticket.id.slice(-8).toUpperCase()}`,
      ticketId: ticket.id,
      ticketSubject: ticket.subject,
      slaDeadline: ticket.slaDeadline,
    });

    this.logger.log(`Complaint ${ticket.id} created by ${reporterId}`);
    return {
      ticketId: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      status: ticket.status,
      slaDeadline: ticket.slaDeadline,
      createdAt: ticket.createdAt,
      message: `Your complaint has been registered. We will respond within ${SLA_HOURS} hours.`,
    };
  }

  // ── GET /api/complaints/my ─────────────────────────────────────────────────

  async getMyComplaints(userId: string) {
    const tickets = await (this.prisma as any).complaintTicket.findMany({
      where: { reporterId: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        subject: true,
        category: true,
        status: true,
        slaBreach: true,
        slaDeadline: true,
        createdAt: true,
        resolvedAt: true,
        responses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { message: true, createdAt: true },
        },
      },
    });
    return tickets.map((t) => ({
      ...t,
      latestResponse: t.responses[0] ?? null,
      responses: undefined,
    }));
  }

  // ── GET /api/complaints/:id ────────────────────────────────────────────────

  async getComplaint(userId: string, ticketId: string, role: string) {
    const ticket = await (this.prisma as any).complaintTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        reporterId: true,
        reportedUserId: true,
        category: true,
        subject: true,
        description: true,
        status: true,
        attachments: true,
        adminNotes: true,
        slaBreach: true,
        slaDeadline: true,
        orderId: true,
        createdAt: true,
        resolvedAt: true,
        updatedAt: true,
        reporter: { select: { email: true } },
        reportedUser: { select: { email: true } },
        responses: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            message: true,
            createdAt: true,
            responder: { select: { email: true } },
          },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Complaint not found');

    const isOwner = ticket.reporterId === userId;
    const isAdmin = role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Access denied');
    }

    return ticket;
  }

  // ── POST /api/complaints/:id/respond (ADMIN) ───────────────────────────────

  async respondToComplaint(
    adminId: string,
    ticketId: string,
    dto: AdminRespondDto,
  ) {
    const ticket = await (this.prisma as any).complaintTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, reporterId: true, status: true },
    });
    if (!ticket) throw new NotFoundException('Complaint not found');

    const [response] = await Promise.all([
      (this.prisma as any).complaintTicketResponse.create({
        data: { ticketId, responderId: adminId, message: dto.message },
        select: { id: true, message: true, createdAt: true },
      }),
      (this.prisma as any).complaintTicket.update({
        where: { id: ticketId },
        data: {
          status: (dto.status as any) ?? ticket.status,
          adminNotes: dto.adminNotes ?? undefined,
          resolvedAt:
            dto.status === 'RESOLVED' || dto.status === 'CLOSED'
              ? new Date()
              : undefined,
        },
      }),
    ]);

    // Notify complainant
    await this.notifQueue.add('send-notification', {
      userId: ticket.reporterId,
      type: 'GENERAL',
      title: 'Update on your complaint',
      body: dto.message.slice(0, 120),
      link: `/buyer/complaints/${ticketId}`,
    });

    return response;
  }

  // ── POST /api/grievance-officer/contact (public) ───────────────────────────

  async submitGrievanceContact(dto: CreateGrievanceContactDto) {
    const contact = await (this.prisma as any).grievanceContact.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? null,
        subject: dto.subject,
        description: dto.description,
        category: dto.category ?? 'OTHER',
      },
      select: {
        id: true,
        subject: true,
        category: true,
        createdAt: true,
      },
    });

    // Notify admin team via email queue
    await this.emailQueue.add('grievance-officer-contact', {
      contactId: contact.id,
      from: dto.email,
      name: dto.name,
      subject: dto.subject,
      category: dto.category,
    });

    return {
      referenceId: contact.id,
      message:
        'Your grievance has been submitted. Our Grievance Officer will respond within 15 days as required by Indian law.',
    };
  }

  // ── SLA Cron: runs every 30 min ────────────────────────────────────────────

  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkSlaBreaches() {
    const now = new Date();
    const result = await (this.prisma as any).complaintTicket.updateMany({
      where: {
        status: 'OPEN',
        slaBreach: false,
        slaDeadline: { lt: now },
      },
      data: { slaBreach: true },
    });

    if (result.count > 0) {
      this.logger.warn(`SLA breach detected: ${result.count} ticket(s) past 48-hour deadline`);
      // Notify admin team
      await this.notifQueue.add('send-notification', {
        type: 'GENERAL',
        title: 'SLA Breach Alert',
        body: `${result.count} complaint ticket(s) have exceeded the 48-hour SLA deadline.`,
        link: '/admin/complaints?filter=breach',
      });
    }
  }
}
