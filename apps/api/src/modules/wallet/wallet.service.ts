import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../database/database.service';
import { RazorpayService } from '../../services/payment/razorpay.service';
import { GstInvoiceService } from '../../services/gst/gst-invoice.service';
import {
  CreateOrderDto,
  VerifyPaymentDto,
  SpendCreditDto,
  CREDIT_PACKS,
  CreditPackId,
  enrichPack,
  GST_RATE,
} from './dto/wallet.dto';

const LOW_BALANCE_THRESHOLD = 5;

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly gstInvoice: GstInvoiceService,
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('payments') private readonly paymentsQueue: Queue,
  ) {}

  // ── Private: resolve & validate seller ───────────────────────────────────

  private async getVerifiedSeller(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      include: { leadCreditWallet: true },
    });

    if (!seller) {
      throw new ForbiddenException('Seller profile not found.');
    }
    if (seller.kycStatus !== 'APPROVED') {
      throw new ForbiddenException('KYC must be approved before using the wallet.');
    }

    return seller;
  }

  /** Ensure the seller has a wallet row, creating it on first access. */
  private async ensureWallet(sellerId: string) {
    return this.prisma.leadCreditWallet.upsert({
      where:  { sellerId },
      create: { sellerId, balance: 0, totalPurchased: 0, totalSpent: 0 },
      update: {},
    });
  }

  // ── GET /seller/wallet ────────────────────────────────────────────────────

  async getWallet(userId: string) {
    const seller = await this.getVerifiedSeller(userId);
    const wallet = await this.ensureWallet(seller.id);

    const transactions = await this.prisma.leadCreditTransaction.findMany({
      where:   { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take:    20,
      select: {
        id: true, type: true, credits: true,
        amount: true, baseAmount: true, gstAmount: true, totalAmount: true,
        status: true, packId: true, invoiceNumber: true, invoicePath: true,
        razorpayPaymentId: true, referenceId: true, createdAt: true,
      },
    });

    const balance        = parseFloat(wallet.balance.toString());
    const totalPurchased = parseFloat(wallet.totalPurchased.toString());
    const totalSpent     = parseFloat(wallet.totalSpent.toString());

    return {
      balance,
      totalPurchased,
      totalSpent,
      lowBalance: balance < LOW_BALANCE_THRESHOLD,
      transactions: transactions.map((t) => ({
        ...t,
        amount:      parseFloat(t.amount.toString()),
        baseAmount:  t.baseAmount  ? parseFloat(t.baseAmount.toString())  : null,
        gstAmount:   t.gstAmount   ? parseFloat(t.gstAmount.toString())   : null,
        totalAmount: t.totalAmount ? parseFloat(t.totalAmount.toString()) : null,
      })),
      packs: Object.values(CREDIT_PACKS).map((p) => enrichPack(p.id as CreditPackId)),
    };
  }

  // ── POST /seller/wallet/create-order ─────────────────────────────────────

  async createOrder(userId: string, dto: CreateOrderDto) {
    const seller = await this.getVerifiedSeller(userId);
    await this.ensureWallet(seller.id);

    const pack = CREDIT_PACKS[dto.packId];
    if (!pack) {
      throw new BadRequestException(`Invalid pack: ${dto.packId}`);
    }

    const enriched    = enrichPack(dto.packId);
    const amountPaise = Math.round(enriched.totalAmount * 100); // paise
    const receipt     = `wallet-${seller.id}-${Date.now()}`;

    // ── Mock mode: no real Razorpay credentials ───────────────────────────
    if (this.razorpay.isMockMode()) {
      const mockOrderId   = `mock_order_${Date.now()}`;
      const mockPaymentId = `mock_pay_${Date.now()}`;
      const mockSignature = this.razorpay.mockSignature(mockOrderId, mockPaymentId);

      const wallet = await this.prisma.leadCreditWallet.findUnique({ where: { sellerId: seller.id } });

      await this.prisma.leadCreditTransaction.create({
        data: {
          sellerId:        seller.id,
          walletId:        wallet!.id,
          type:            'PURCHASE',
          credits:         pack.credits,
          amount:          enriched.totalAmount,
          baseAmount:      enriched.baseAmount,
          gstAmount:       enriched.gstAmount,
          totalAmount:     enriched.totalAmount,
          packId:          pack.id,
          razorpayOrderId: mockOrderId,
          status:          'PENDING',
        },
      });

      this.logger.warn(`[MOCK] Razorpay order ${mockOrderId} created for seller ${seller.id}`);

      return {
        razorpayOrderId: mockOrderId,
        amount:          amountPaise,
        currency:        'INR',
        keyId:           'mock',
        pack:            enriched,
        isMock:          true,
        mockPaymentId,
        mockSignature,
      };
    }

    // ── Real Razorpay flow ────────────────────────────────────────────────
    const rpOrder = await this.razorpay.createOrder(amountPaise, receipt, {
      sellerId: seller.id,
      packId:   pack.id,
    });

    const wallet = await this.prisma.leadCreditWallet.findUnique({ where: { sellerId: seller.id } });

    await this.prisma.leadCreditTransaction.create({
      data: {
        sellerId:        seller.id,
        walletId:        wallet!.id,
        type:            'PURCHASE',
        credits:         pack.credits,
        amount:          enriched.totalAmount,
        baseAmount:      enriched.baseAmount,
        gstAmount:       enriched.gstAmount,
        totalAmount:     enriched.totalAmount,
        packId:          pack.id,
        razorpayOrderId: rpOrder.id,
        status:          'PENDING',
      },
    });

    this.logger.log(`Razorpay order ${rpOrder.id} created for seller ${seller.id} (pack: ${pack.id})`);

    return {
      razorpayOrderId: rpOrder.id,
      amount:          rpOrder.amount,
      currency:        rpOrder.currency,
      keyId:           this.razorpay.getKeyId(),
      pack:            enriched,
      isMock:          false,
    };
  }

  // ── POST /seller/wallet/verify-payment ───────────────────────────────────

  async verifyPayment(userId: string, dto: VerifyPaymentDto) {
    const seller = await this.getVerifiedSeller(userId);

    // 1. Verify HMAC signature — skip in mock mode
    const isMockPayment = dto.razorpayOrderId.startsWith('mock_order_');
    if (isMockPayment) {
      // Verify mock signature to ensure it came from our own server
      const expectedMock = this.razorpay.mockSignature(dto.razorpayOrderId, dto.razorpayPaymentId);
      if (dto.razorpaySignature !== expectedMock) {
        throw new BadRequestException('Mock payment verification failed: invalid mock signature');
      }
      this.logger.warn(`[MOCK] Processing mock payment for order ${dto.razorpayOrderId}`);
    } else {
      const signatureValid = this.razorpay.verifyPaymentSignature(
        dto.razorpayOrderId,
        dto.razorpayPaymentId,
        dto.razorpaySignature,
      );

      if (!signatureValid) {
        this.logger.warn(
          `Invalid payment signature from seller ${seller.id} for order ${dto.razorpayOrderId}`,
        );
        throw new BadRequestException('Payment verification failed: invalid signature');
      }
    }

    // 2. Find the pending transaction for this order
    const pending = await this.prisma.leadCreditTransaction.findFirst({
      where: { razorpayOrderId: dto.razorpayOrderId, sellerId: seller.id },
    });

    if (!pending) {
      throw new NotFoundException('Order not found. Please contact support.');
    }

    // 3. Idempotency: already processed?
    if (pending.status === 'COMPLETED') {
      const wallet = await this.prisma.leadCreditWallet.findUnique({
        where: { sellerId: seller.id },
      });
      return {
        success:        true,
        newBalance:     parseFloat(wallet!.balance.toString()),
        alreadyApplied: true,
        invoiceNumber:  pending.invoiceNumber,
      };
    }

    // Check another payment ID hasn't been used for this (replay with different payment)
    if (pending.razorpayPaymentId && pending.razorpayPaymentId !== dto.razorpayPaymentId) {
      throw new ConflictException('Duplicate order detected with different payment ID');
    }

    const pack    = CREDIT_PACKS[pending.packId as CreditPackId];
    const credits = pending.credits || pack?.credits || 0;

    // 4. Generate invoice number before transaction
    const now = new Date();
    const invoiceNumber = await this.gstInvoice.generateInvoiceNumber(now);

    // 5. Compute GST breakdown (state comes from seller; fetch only what's needed for tax)
    const baseAmount = parseFloat(pending.baseAmount?.toString() ?? '0');
    const taxData    = this.gstInvoice.computeTax(baseAmount, seller.state ?? undefined);

    // 6. Atomic DB transaction: credit wallet + update transaction record
    const updatedWallet = await this.prisma.$transaction(async (tx) => {
      // a. Mark the pending transaction as COMPLETED + attach payment ID
      await tx.leadCreditTransaction.update({
        where: { id: pending.id },
        data: {
          razorpayPaymentId: dto.razorpayPaymentId,
          status:            'COMPLETED',
          invoiceNumber,
          // Only set referenceId if not already set (avoid unique constraint on retry)
          ...(pending.referenceId ? {} : { referenceId: `pay:${dto.razorpayPaymentId}` }),
        },
      });

      // b. Credit the wallet atomically
      const wallet = await tx.leadCreditWallet.update({
        where: { sellerId: seller.id },
        data: {
          balance:         { increment: credits },
          totalPurchased:  { increment: credits },
          lastRechargeDate: now,
        },
      });

      return wallet;
    });

    // 7. Generate GST invoice + send email — both fire-and-forget (non-blocking)
    const pendingId         = pending.id;
    const razorpayPaymentId = dto.razorpayPaymentId;
    setImmediate(async () => {
      // 7a. Fetch seller details needed for invoice (deferred — not on critical path)
      let seller_: { companyName: string | null; gstNumber: string | null; state: string | null } | null = null;
      try {
        seller_ = await this.prisma.seller.findUnique({
          where:  { id: seller.id },
          select: { companyName: true, gstNumber: true, state: true },
        });
      } catch (err: any) {
        this.logger.warn(`Could not fetch seller details for invoice ${pendingId}: ${err.message}`);
      }

      // 7b. Generate invoice
      try {
        const invoicePath = await this.gstInvoice.generateInvoice({
          transactionId:     pendingId,
          invoiceNumber,
          date:              now,
          buyerName:         seller_?.companyName ?? 'Seller',
          buyerGstin:        seller_?.gstNumber   ?? undefined,
          buyerState:        seller_?.state        ?? undefined,
          platformName:      'B2B Marketplace Pvt Ltd',
          platformGstin:     'B2B-PLATFORM-GSTIN',
          platformAddress:   '123 Tech Park, Bangalore, Karnataka 560001',
          packName:          pack?.name ?? pending.packId ?? '',
          credits,
          baseAmount,
          gstRate:           GST_RATE,
          cgst:              taxData.cgst,
          sgst:              taxData.sgst,
          igst:              taxData.igst,
          gstAmount:         taxData.gstAmount,
          totalAmount:       parseFloat(pending.totalAmount?.toString() ?? '0'),
          razorpayPaymentId,
        });
        await this.prisma.leadCreditTransaction.update({
          where: { id: pendingId },
          data:  { invoicePath },
        });
      } catch (err: any) {
        this.logger.error(`Invoice generation failed for txn ${pendingId}: ${err.message}`);
      }

      // 7c. Queue confirmation email (best-effort, non-blocking)
      this.emailQueue.add({
        to:         seller_?.companyName ?? '',
        from:       'no-reply@b2bmarketplace.in',
        subject:    `Lead Credits Recharged — ${credits} credits added`,
        templateId: 'wallet-recharge-confirmation',
        data: {
          companyName: seller_?.companyName,
          credits,
          invoiceNumber,
          totalAmount: parseFloat(pending.totalAmount?.toString() ?? '0'),
        },
        requestId: `wallet-confirm-${pendingId}`,
      }).catch((err: any) => {
        this.logger.warn(`Email queue failed for payment ${razorpayPaymentId}: ${err.message}`);
      });
    });

    const newBalance = parseFloat(updatedWallet.balance.toString());
    this.logger.log(
      `Payment verified: seller=${seller.id} credits=+${credits} newBalance=${newBalance}`,
    );

    return {
      success:        true,
      newBalance,
      creditsAdded:   credits,
      invoiceNumber,
      invoicePath:    null, // generated async — available after a moment via wallet reload
    };
  }

  // ── POST /seller/wallet/spend-credit ──────────────────────────────────────

  async spendCredit(sellerId: string, dto: SpendCreditDto) {
    const creditsToSpend = dto.credits ?? 1;

    // Idempotency: already spent for this reference?
    const existing = await this.prisma.leadCreditTransaction.findFirst({
      where: { referenceId: dto.referenceId, type: 'SPEND' },
    });
    if (existing) {
      const wallet = await this.prisma.leadCreditWallet.findUnique({ where: { sellerId } });
      return {
        success:        true,
        newBalance:     parseFloat(wallet!.balance.toString()),
        alreadyApplied: true,
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Lock-read the wallet row
      const wallet = await tx.leadCreditWallet.findUnique({ where: { sellerId } });

      if (!wallet) {
        throw new BadRequestException('Wallet not found. Please recharge first.');
      }

      const balance = parseFloat(wallet.balance.toString());
      if (balance < creditsToSpend) {
        throw new BadRequestException({
          code:    'INSUFFICIENT_CREDITS',
          message: `Insufficient credits. Balance: ${balance}, required: ${creditsToSpend}`,
        });
      }

      const updated = await tx.leadCreditWallet.update({
        where: { sellerId },
        data:  {
          balance:    { decrement: creditsToSpend },
          totalSpent: { increment: creditsToSpend },
        },
      });

      await tx.leadCreditTransaction.create({
        data: {
          sellerId,
          walletId:    wallet.id,
          type:        'SPEND',
          credits:     creditsToSpend,
          amount:      creditsToSpend,
          status:      'COMPLETED',
          referenceId: dto.referenceId,
        },
      });

      return updated;
    });

    const newBalance = parseFloat(result.balance.toString());
    this.logger.log(`Credit spent: seller=${sellerId} spent=${creditsToSpend} newBalance=${newBalance}`);

    return { success: true, newBalance };
  }

  // ── GET /seller/wallet/invoice/:transactionId ─────────────────────────────

  async getInvoice(userId: string, transactionId: string) {
    const seller = await this.getVerifiedSeller(userId);

    const txn = await this.prisma.leadCreditTransaction.findFirst({
      where: { id: transactionId, sellerId: seller.id, type: 'PURCHASE' },
    });

    if (!txn) throw new NotFoundException('Transaction not found');
    if (!txn.invoiceNumber) throw new NotFoundException('Invoice number not assigned to this transaction');

    // If invoicePath is missing or file was deleted, regenerate on-demand
    const needsRegen = !txn.invoicePath || !this.gstInvoice.invoiceExists(txn.invoicePath);
    if (needsRegen) {
      this.logger.log(`Invoice missing for txn ${transactionId} — regenerating`);
      try {
        const sellerDetails = await this.prisma.seller.findUnique({
          where: { id: seller.id },
          select: { companyName: true, gstNumber: true, state: true },
        });

        const taxData = this.gstInvoice.computeTax(
          parseFloat(txn.baseAmount?.toString() ?? '0'),
          sellerDetails?.state ?? undefined,
        );

        const pack = txn.packId ? (CREDIT_PACKS as Record<string, any>)[txn.packId] ?? null : null;
        const credits = txn.credits || 1;
        const baseAmount = parseFloat(txn.baseAmount?.toString() ?? '0');
        const totalAmount = parseFloat(txn.totalAmount?.toString() ?? '0');

        const invoicePath = await this.gstInvoice.generateInvoice({
          transactionId,
          invoiceNumber:   txn.invoiceNumber,
          date:            txn.createdAt,
          buyerName:       sellerDetails?.companyName ?? 'Seller',
          buyerGstin:      sellerDetails?.gstNumber   ?? undefined,
          buyerState:      sellerDetails?.state        ?? undefined,
          platformName:    'B2B Marketplace Pvt Ltd',
          platformGstin:   'B2B-PLATFORM-GSTIN',
          platformAddress: '123 Tech Park, Bangalore, Karnataka 560001',
          packName:        pack?.name ?? txn.packId ?? 'Lead Credits',
          credits,
          baseAmount,
          gstRate:         GST_RATE,
          cgst:            taxData.cgst,
          sgst:            taxData.sgst,
          igst:            taxData.igst,
          gstAmount:       taxData.gstAmount,
          totalAmount,
          razorpayPaymentId: txn.razorpayPaymentId ?? undefined,
        });

        await this.prisma.leadCreditTransaction.update({
          where: { id: transactionId },
          data:  { invoicePath },
        });

        return {
          invoiceNumber: txn.invoiceNumber,
          invoicePath,
          buffer:        this.gstInvoice.readInvoice(invoicePath),
          isHtml:        invoicePath.endsWith('.html'),
        };
      } catch (err: any) {
        this.logger.error(`On-demand invoice regeneration failed for txn ${transactionId}: ${err.message}`);
        throw new NotFoundException('Invoice could not be generated. Please contact support.');
      }
    }

    return {
      invoiceNumber: txn.invoiceNumber,
      invoicePath:   txn.invoicePath!,
      buffer:        this.gstInvoice.readInvoice(txn.invoicePath!),
      isHtml:        txn.invoicePath!.endsWith('.html'),
    };
  }

  // ── Webhook: process Razorpay payment.captured ────────────────────────────

  async handleWebhookPaymentCapture(
    razorpayOrderId: string,
    razorpayPaymentId: string,
  ): Promise<void> {
    // Idempotency: if payment already credited, skip
    const existing = await this.prisma.leadCreditTransaction.findFirst({
      where: { razorpayPaymentId, status: 'COMPLETED' },
    });
    if (existing) {
      this.logger.log(`Webhook: payment ${razorpayPaymentId} already processed — skipping`);
      return;
    }

    const pending = await this.prisma.leadCreditTransaction.findFirst({
      where: { razorpayOrderId, status: 'PENDING' },
    });
    if (!pending) {
      this.logger.warn(`Webhook: no PENDING txn for order ${razorpayOrderId}`);
      return;
    }

    // Queue the credit-addition job so it's processed reliably
    await this.paymentsQueue.add('credit-wallet', {
      transactionId:     pending.id,
      sellerId:          pending.sellerId,
      razorpayOrderId,
      razorpayPaymentId,
      credits:           pending.credits,
    });

    this.logger.log(`Webhook: queued wallet credit for payment ${razorpayPaymentId}`);
  }
}
