import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../../database/database.service';

/**
 * Module 16 — Matches newly-posted buy requirements to approved + verified
 * sellers whose approved products share the buyer's category, then:
 *   1. Creates an in-app Notification row per seller (NEW_LEAD).
 *   2. Enqueues an email job (`notifications` queue, `new-lead-match` job).
 *   3. Adds a low-credit nudge notification when the seller's wallet balance
 *      is at / below their low-balance threshold (so they recharge before
 *      attempting to reveal contact).
 *
 * Capped at 50 sellers per lead to avoid fan-out storms — same cap used in
 * `BuyLeadsService._notifyMatchingSellers` (kept consistent intentionally).
 */
@Injectable()
export class RequirementMatchingService {
  private readonly logger = new Logger(RequirementMatchingService.name);
  private readonly MAX_SELLERS_PER_LEAD = 50;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  async notifyMatchingSellers(lead: {
    id: string;
    productName: string;
    categoryId: string | null;
  }) {
    const whereCategory = lead.categoryId
      ? { categories: { some: { categoryId: lead.categoryId } } }
      : { name: { contains: lead.productName, mode: 'insensitive' as const } };

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
      select: {
        id: true,
        companyName: true,
        userId: true,
        leadCreditWallet: {
          select: { balance: true, lowBalanceThreshold: true },
        },
      },
      take: this.MAX_SELLERS_PER_LEAD,
    });

    this.logger.log(
      `Requirement ${lead.id}: notifying ${sellers.length} matching seller(s)`,
    );

    for (const seller of sellers) {
      // In-app notification (best-effort)
      await this.prisma.notification
        .create({
          data: {
            userId: seller.userId,
            type: 'NEW_LEAD',
            title: `New buy requirement: ${lead.productName}`,
            body: `A buyer is looking for "${lead.productName}". Reveal contact to connect.`,
            isRead: false,
            metadata: { leadId: lead.id },
          },
        })
        .catch(() => undefined);

      // Low-credit nudge — prompts recharge before they try to reveal
      const balance = seller.leadCreditWallet
        ? Number(seller.leadCreditWallet.balance)
        : 0;
      const threshold = seller.leadCreditWallet?.lowBalanceThreshold ?? 0;
      if (balance <= threshold) {
        await this.prisma.notification
          .create({
            data: {
              userId: seller.userId,
              type: 'LOW_CREDIT',
              title: 'Recharge your lead wallet',
              body: `You have ${balance} credits left — recharge now to reveal the new ${lead.productName} buyer.`,
              isRead: false,
              metadata: { leadId: lead.id, balance },
            },
          })
          .catch(() => undefined);
      }

      // Email notification via queue (best-effort)
      this.notificationsQueue
        .add('new-lead-match', {
          sellerId: seller.id,
          userId: seller.userId,
          companyName: seller.companyName,
          leadId: lead.id,
          productName: lead.productName,
          type: 'EMAIL',
          templateId: 'new-lead-match',
          data: {
            companyName: seller.companyName,
            productName: lead.productName,
            leadId: lead.id,
          },
          requestId: uuidv4(),
        })
        .catch(() => undefined);
    }

    return { notified: sellers.length };
  }
}
