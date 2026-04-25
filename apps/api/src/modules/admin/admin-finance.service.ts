import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import { RazorpayService } from '../../services/payment/razorpay.service';
import { ProcessRefundDto, TransactionFilterDto, GstrExportDto } from './dto/finance.dto';

const PLATFORM_STATE = 'Karnataka'; // Update via env in production
const GST_RATE = 0.18;

@Injectable()
export class AdminFinanceService {
  private readonly logger = new Logger(AdminFinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly razorpay: RazorpayService,
  ) {}

  async getOverview() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // All PURCHASE transactions (last 30 days)
    const purchases30d = await this.prisma.leadCreditTransaction.findMany({
      where: { type: 'PURCHASE', status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } },
      select: {
        baseAmount: true, gstAmount: true, totalAmount: true,
        credits: true, createdAt: true,
        seller: { select: { state: true, gstNumber: true } },
      },
    });

    // Refunds last 30 days
    const refunds30d = await this.prisma.leadCreditTransaction.aggregate({
      where: { type: 'REFUND', createdAt: { gte: thirtyDaysAgo } },
      _sum: { totalAmount: true },
    });

    // Credits spent (SPEND type)
    const creditsSpent30d = await this.prisma.leadCreditTransaction.aggregate({
      where: { type: 'SPEND', createdAt: { gte: thirtyDaysAgo } },
      _sum: { credits: true },
    });

    // Aggregate revenue + GST split
    let totalRevenue = 0;
    let cgst = 0, sgst = 0, igst = 0;
    let totalCreditsIssued = 0;
    const revenueByDay: Record<string, number> = {};

    for (const txn of purchases30d) {
      const total = Number(txn.totalAmount ?? 0);
      const gst = Number(txn.gstAmount ?? 0);
      const base = Number(txn.baseAmount ?? 0);
      totalRevenue += total;
      totalCreditsIssued += txn.credits;

      // IGST for inter-state; CGST+SGST for intra-state (Karnataka)
      if (txn.seller.state === PLATFORM_STATE) {
        cgst += gst / 2;
        sgst += gst / 2;
      } else {
        igst += gst;
      }

      // Day bucket (YYYY-MM-DD)
      const day = txn.createdAt.toISOString().slice(0, 10);
      revenueByDay[day] = (revenueByDay[day] ?? 0) + base;
    }

    // Fill missing days with 0 for chart continuity
    const days: { date: string; revenue: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      days.push({ date: d, revenue: Math.round((revenueByDay[d] ?? 0) * 100) / 100 });
    }

    // Top sellers by spend (all time)
    const topSellersRaw = await this.prisma.leadCreditTransaction.groupBy({
      by: ['sellerId'],
      where: { type: 'PURCHASE', status: 'COMPLETED' },
      _sum: { totalAmount: true, credits: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 5,
    });

    const sellerIds = topSellersRaw.map((s) => s.sellerId);
    const sellerDetails = await this.prisma.seller.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, companyName: true, gstNumber: true, state: true },
    });
    const sellerMap = Object.fromEntries(sellerDetails.map((s) => [s.id, s]));

    const topSellersBySpend = topSellersRaw.map((s) => ({
      seller: sellerMap[s.sellerId] ?? { id: s.sellerId },
      totalSpend: Number(s._sum.totalAmount ?? 0),
      totalCredits: s._sum.credits ?? 0,
    }));

    // Facilitation fees: platform earns full base amount (we're the service provider)
    const facilitationFees30d = purchases30d.reduce((acc, t) => acc + Number(t.baseAmount ?? 0), 0);

    return {
      totalRevenue30d: Math.round(totalRevenue * 100) / 100,
      totalCreditsIssued30d: totalCreditsIssued,
      totalCreditsSpent30d: creditsSpent30d._sum.credits ?? 0,
      facilitationFees30d: Math.round(facilitationFees30d * 100) / 100,
      refundsProcessed30d: Math.round(Number(refunds30d._sum.totalAmount ?? 0) * 100) / 100,
      gstCollected: {
        cgst: Math.round(cgst * 100) / 100,
        sgst: Math.round(sgst * 100) / 100,
        igst: Math.round(igst * 100) / 100,
        total: Math.round((cgst + sgst + igst) * 100) / 100,
      },
      topSellersBySpend,
      revenueByDay: days,
    };
  }

  async getTransactions(dto: TransactionFilterDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (dto.type) where.type = dto.type;
    if (dto.sellerId) where.sellerId = dto.sellerId;
    if (dto.from || dto.to) {
      where.createdAt = {};
      if (dto.from) where.createdAt.gte = new Date(dto.from);
      if (dto.to) {
        const toDate = new Date(dto.to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }
    if (dto.search) {
      where.OR = [
        { invoiceNumber: { contains: dto.search, mode: 'insensitive' } },
        { razorpayPaymentId: { contains: dto.search, mode: 'insensitive' } },
        { seller: { companyName: { contains: dto.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.leadCreditTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, type: true, credits: true, amount: true,
          baseAmount: true, gstAmount: true, totalAmount: true,
          status: true, invoiceNumber: true, invoicePath: true,
          razorpayPaymentId: true, razorpayOrderId: true,
          packId: true, createdAt: true,
          seller: { select: { id: true, companyName: true, gstNumber: true, state: true } },
        },
      }),
      this.prisma.leadCreditTransaction.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getInvoices(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.leadCreditTransaction.findMany({
        where: { type: 'PURCHASE', invoiceNumber: { not: null }, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, invoiceNumber: true, invoicePath: true,
          totalAmount: true, gstAmount: true, baseAmount: true,
          credits: true, createdAt: true,
          seller: { select: { id: true, companyName: true, gstNumber: true } },
        },
      }),
      this.prisma.leadCreditTransaction.count({
        where: { type: 'PURCHASE', invoiceNumber: { not: null }, status: 'COMPLETED' },
      }),
    ]);
    return { items, total, page, limit };
  }

  async processRefund(dto: ProcessRefundDto, adminUserId: string) {
    const txn = await this.prisma.leadCreditTransaction.findUnique({
      where: { razorpayPaymentId: dto.razorpayPaymentId },
      include: { seller: { select: { id: true, companyName: true, userId: true } } },
    });

    if (!txn) throw new NotFoundException('Transaction not found for this payment ID');
    if (txn.type !== 'PURCHASE') throw new BadRequestException('Only PURCHASE transactions can be refunded');
    if (txn.status === 'REFUNDED') throw new BadRequestException('This payment has already been refunded');

    // Initiate refund via Razorpay
    const refundResult = await this.razorpay.refundPayment(
      dto.razorpayPaymentId,
      dto.amountPaise,
    );

    const refundAmount = dto.amountPaise
      ? dto.amountPaise / 100
      : Number(txn.totalAmount ?? txn.amount);

    await this.prisma.$transaction(async (tx) => {
      // Mark original transaction refunded
      await tx.leadCreditTransaction.update({
        where: { id: txn.id },
        data: { status: 'REFUNDED' },
      });

      // Create REFUND transaction record
      await tx.leadCreditTransaction.create({
        data: {
          sellerId: txn.sellerId,
          walletId: txn.walletId,
          type: 'REFUND',
          credits: -txn.credits,
          amount: -refundAmount,
          totalAmount: -refundAmount,
          status: 'COMPLETED',
          razorpayPaymentId: `${dto.razorpayPaymentId}_refund_${refundResult.id}`,
          referenceId: refundResult.id,
        },
      });

      // Deduct credits from wallet
      if (txn.walletId) {
        await tx.leadCreditWallet.update({
          where: { id: txn.walletId },
          data: {
            balance: { decrement: txn.credits },
            totalPurchased: { decrement: txn.credits },
          },
        });
      }
    });

    await this.auditService.logAction({
      userId: adminUserId,
      entityType: 'WALLET_REFUND',
      entityId: txn.id,
      action: 'UPDATE',
      newValue: {
        razorpayRefundId: refundResult.id,
        amount: refundAmount,
        reason: dto.reason,
        sellerCompany: txn.seller.companyName,
      },
    });

    this.logger.log(`Refund processed: ${refundResult.id} for payment ${dto.razorpayPaymentId} by admin ${adminUserId}`);
    return {
      refundId: refundResult.id,
      paymentId: dto.razorpayPaymentId,
      amountRefunded: refundAmount,
      status: refundResult.status,
    };
  }

  async generateGstr1Csv(dto: GstrExportDto): Promise<string> {
    // Parse period filter
    let from: Date;
    let to: Date;
    const period = dto.period ?? new Date().toISOString().slice(0, 7); // default current month

    if (/^\d{4}-\d{2}$/.test(period)) {
      // Monthly: YYYY-MM
      const [year, month] = period.split('-').map(Number);
      from = new Date(year, month - 1, 1);
      to = new Date(year, month, 0, 23, 59, 59, 999);
    } else if (/^\d{4}-Q[1-4]$/.test(period)) {
      // Quarterly: YYYY-Q1..Q4
      const [year, q] = period.split('-');
      const quarter = parseInt(q.replace('Q', ''), 10);
      const startMonth = (quarter - 1) * 3;
      from = new Date(parseInt(year), startMonth, 1);
      to = new Date(parseInt(year), startMonth + 3, 0, 23, 59, 59, 999);
    } else {
      throw new BadRequestException('Invalid period format. Use YYYY-MM or YYYY-Q1..Q4');
    }

    const transactions = await this.prisma.leadCreditTransaction.findMany({
      where: {
        type: 'PURCHASE',
        status: 'COMPLETED',
        invoiceNumber: { not: null },
        createdAt: { gte: from, lte: to },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        invoiceNumber: true, createdAt: true,
        baseAmount: true, gstAmount: true, totalAmount: true,
        seller: { select: { gstNumber: true, state: true, companyName: true } },
      },
    });

    // GSTR-1 format columns
    const header = [
      'GSTIN of Buyer',
      'Legal Name of Buyer',
      'Invoice Number',
      'Invoice Date',
      'Invoice Value',
      'Taxable Value',
      'IGST Amount',
      'CGST Amount',
      'SGST Amount',
    ].join(',');

    const rows = transactions.map((t) => {
      const base = Number(t.baseAmount ?? 0);
      const gst = Number(t.gstAmount ?? 0);
      const total = Number(t.totalAmount ?? 0);
      const isInterState = t.seller.state !== PLATFORM_STATE;
      const igst = isInterState ? gst : 0;
      const cgst = isInterState ? 0 : gst / 2;
      const sgst = isInterState ? 0 : gst / 2;
      const date = t.createdAt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

      return [
        t.seller.gstNumber ?? '',
        `"${t.seller.companyName}"`,
        t.invoiceNumber ?? '',
        date,
        total.toFixed(2),
        base.toFixed(2),
        igst.toFixed(2),
        cgst.toFixed(2),
        sgst.toFixed(2),
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  async generateLedgerCsv(dto: TransactionFilterDto): Promise<string> {
    const where: any = {};
    if (dto.from) where.createdAt = { ...(where.createdAt ?? {}), gte: new Date(dto.from) };
    if (dto.to) {
      const toDate = new Date(dto.to);
      toDate.setHours(23, 59, 59, 999);
      where.createdAt = { ...(where.createdAt ?? {}), lte: toDate };
    }
    if (dto.type) where.type = dto.type;

    const txns = await this.prisma.leadCreditTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
      select: {
        id: true, type: true, credits: true, baseAmount: true,
        gstAmount: true, totalAmount: true, status: true,
        invoiceNumber: true, razorpayPaymentId: true, createdAt: true,
        seller: { select: { companyName: true, gstNumber: true, state: true } },
      },
    });

    const header = [
      'Transaction ID', 'Date', 'Type', 'Company', 'GSTIN', 'State',
      'Credits', 'Base Amount', 'GST Amount', 'Total Amount',
      'Status', 'Invoice Number', 'Razorpay Payment ID',
    ].join(',');

    const rows = txns.map((t) => [
      t.id,
      t.createdAt.toISOString().slice(0, 10),
      t.type,
      `"${t.seller.companyName}"`,
      t.seller.gstNumber ?? '',
      t.seller.state ?? '',
      t.credits,
      Number(t.baseAmount ?? 0).toFixed(2),
      Number(t.gstAmount ?? 0).toFixed(2),
      Number(t.totalAmount ?? 0).toFixed(2),
      t.status,
      t.invoiceNumber ?? '',
      t.razorpayPaymentId ?? '',
    ].join(','));

    return [header, ...rows].join('\n');
  }
}
