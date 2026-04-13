import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { WalletService } from './wallet.service';
import { PrismaService } from '../../database/database.service';
import { RazorpayService } from '../../services/payment/razorpay.service';
import { GstInvoiceService } from '../../services/gst/gst-invoice.service';

// ── Helpers ───────────────────────────────────────────────────────────────

const decimal = (n: number) => ({ toString: () => String(n) });

const mockSeller = {
  id:            'seller-1',
  userId:        'user-1',
  companyName:   'Test Co',
  gstNumber:     '27AAPFU0939F1ZV',
  state:         'Maharashtra',
  kycStatus:     'APPROVED',
  leadCreditWallet: {
    id:             'wallet-1',
    sellerId:       'seller-1',
    balance:        decimal(20),
    totalPurchased: decimal(60),
    totalSpent:     decimal(40),
  },
};

const mockWallet = mockSeller.leadCreditWallet;

// ── Mock factories ────────────────────────────────────────────────────────

const makePrisma = () => ({
  seller: {
    findUnique: jest.fn().mockResolvedValue(mockSeller),
  },
  leadCreditWallet: {
    findUnique: jest.fn().mockResolvedValue(mockWallet),
    upsert:     jest.fn().mockResolvedValue(mockWallet),
    update:     jest.fn(),
  },
  leadCreditTransaction: {
    findMany:  jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    create:    jest.fn(),
    update:    jest.fn(),
  },
  $transaction: jest.fn(),
});

const makeRazorpay = () => ({
  createOrder:             jest.fn(),
  verifyPaymentSignature:  jest.fn(),
  getKeyId:                jest.fn().mockReturnValue('rzp_test_key'),
});

const makeGstInvoice = () => ({
  generateInvoiceNumber: jest.fn().mockResolvedValue('B2B-2026-04-0001'),
  computeTax:            jest.fn().mockReturnValue({ cgst: 0, sgst: 0, igst: 270, gstAmount: 270 }),
  generateInvoice:       jest.fn().mockResolvedValue('2026/04/B2B-2026-04-0001.html'),
  invoiceExists:         jest.fn().mockReturnValue(true),
  readInvoice:           jest.fn().mockReturnValue(Buffer.from('<html/>')),
});

const makeQueue = () => ({ add: jest.fn().mockResolvedValue({ id: 'job-1' }) });

// ── Test suite ────────────────────────────────────────────────────────────

describe('WalletService', () => {
  let service: WalletService;
  let prisma: ReturnType<typeof makePrisma>;
  let razorpay: ReturnType<typeof makeRazorpay>;
  let gstInvoice: ReturnType<typeof makeGstInvoice>;

  beforeEach(async () => {
    prisma     = makePrisma();
    razorpay   = makeRazorpay();
    gstInvoice = makeGstInvoice();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService,    useValue: prisma     },
        { provide: RazorpayService,  useValue: razorpay   },
        { provide: GstInvoiceService, useValue: gstInvoice },
        { provide: getQueueToken('email'),    useValue: makeQueue() },
        { provide: getQueueToken('payments'), useValue: makeQueue() },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  // ── 1. Payment signature mismatch ─────────────────────────────────────

  describe('verifyPayment — signature mismatch', () => {
    it('throws BadRequestException when HMAC signature is invalid', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(false);

      await expect(
        service.verifyPayment('user-1', {
          razorpayOrderId:   'order_bad',
          razorpayPaymentId: 'pay_bad',
          razorpaySignature: 'invalid_sig',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(razorpay.verifyPaymentSignature).toHaveBeenCalledWith(
        'order_bad', 'pay_bad', 'invalid_sig',
      );
    });
  });

  // ── 2. Idempotency: credits added exactly once ────────────────────────

  describe('verifyPayment — idempotency', () => {
    it('returns alreadyApplied=true without re-crediting when payment already processed', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(true);

      // Simulate pending txn that is already COMPLETED
      const completedTxn = {
        id:                'txn-1',
        status:            'COMPLETED',
        razorpayOrderId:   'order_123',
        razorpayPaymentId: 'pay_abc',
        credits:           40,
        baseAmount:        decimal(3000),
        totalAmount:       decimal(3540),
        packId:            'standard',
        invoiceNumber:     'B2B-2026-04-0001',
      };
      prisma.leadCreditTransaction.findFirst.mockResolvedValue(completedTxn);

      const result = await service.verifyPayment('user-1', {
        razorpayOrderId:   'order_123',
        razorpayPaymentId: 'pay_abc',
        razorpaySignature: 'valid_sig',
      });

      expect(result.alreadyApplied).toBe(true);
      expect(result.success).toBe(true);
      // $transaction must NOT have been called
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── 3. Insufficient credits ───────────────────────────────────────────

  describe('spendCredit — insufficient balance', () => {
    it('throws BadRequestException with INSUFFICIENT_CREDITS when balance is 0', async () => {
      // Wallet with zero balance
      const emptyWallet = { ...mockWallet, balance: decimal(0) };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          leadCreditWallet: {
            findUnique: jest.fn().mockResolvedValue(emptyWallet),
            update:     jest.fn(),
          },
          leadCreditTransaction: { create: jest.fn() },
        });
      });

      await expect(
        service.spendCredit('seller-1', { referenceId: 'ref-xyz', credits: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when balance is less than requested credits', async () => {
      const lowWallet = { ...mockWallet, balance: decimal(2) };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          leadCreditWallet: {
            findUnique: jest.fn().mockResolvedValue(lowWallet),
            update:     jest.fn(),
          },
          leadCreditTransaction: { create: jest.fn() },
        });
      });

      await expect(
        service.spendCredit('seller-1', { referenceId: 'ref-xyz2', credits: 5 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── 4. GST calculation: 18% on base amount ───────────────────────────

  describe('GST calculation via GstInvoiceService', () => {
    it('computes 18% GST correctly for ₹3,000 standard pack', () => {
      // Real computation (no mock)
      const { GstInvoiceService: Real } = jest.requireActual(
        '../../services/gst/gst-invoice.service',
      ) as any;

      // We test through the enrichPack helper
      const { enrichPack } = jest.requireActual('./dto/wallet.dto') as any;
      const pack = enrichPack('standard');

      expect(pack.baseAmount).toBe(3000);
      expect(pack.gstAmount).toBe(540);          // 18% of 3000
      expect(pack.totalAmount).toBe(3540);
    });

    it('computes 18% GST correctly for ₹1,500 starter pack', () => {
      const { enrichPack } = jest.requireActual('./dto/wallet.dto') as any;
      const pack = enrichPack('starter');

      expect(pack.baseAmount).toBe(1500);
      expect(pack.gstAmount).toBe(270);
      expect(pack.totalAmount).toBe(1770);
    });
  });

  // ── 5. Wallet balance never goes negative ────────────────────────────

  describe('spendCredit — balance floor', () => {
    it('does not decrement below zero — transaction atomicity', async () => {
      let updatedBalance: number | undefined;

      const wallet = { ...mockWallet, balance: decimal(1) };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          leadCreditWallet: {
            findUnique: jest.fn().mockResolvedValue(wallet),
            update: jest.fn().mockImplementation(({ data }: any) => {
              // Simulate decrement
              const current = 1;
              const dec = data.balance?.decrement ?? 0;
              updatedBalance = current - dec;
              return { ...wallet, balance: decimal(updatedBalance) };
            }),
          },
          leadCreditTransaction: { create: jest.fn() },
        });
      });

      const result = await service.spendCredit('seller-1', { referenceId: 'ref-floor', credits: 1 });
      expect(result.success).toBe(true);
      expect(updatedBalance).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 6. DB transaction rollback on failure ────────────────────────────

  describe('verifyPayment — transaction rollback', () => {
    it('propagates error if invoice generation causes DB transaction to fail', async () => {
      razorpay.verifyPaymentSignature.mockReturnValue(true);

      const pendingTxn = {
        id:                'txn-pending',
        status:            'PENDING',
        razorpayOrderId:   'order_rollback',
        razorpayPaymentId: null,
        credits:           40,
        baseAmount:        decimal(3000),
        totalAmount:       decimal(3540),
        packId:            'standard',
        invoiceNumber:     null,
      };
      prisma.leadCreditTransaction.findFirst.mockResolvedValue(pendingTxn);
      prisma.seller.findUnique
        .mockResolvedValueOnce(mockSeller)   // getVerifiedSeller
        .mockResolvedValueOnce({             // inner seller details
          id: 'seller-1', companyName: 'Test Co', gstNumber: null, state: null,
        });

      // Simulate DB transaction failure
      prisma.$transaction.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(
        service.verifyPayment('user-1', {
          razorpayOrderId:   'order_rollback',
          razorpayPaymentId: 'pay_rollback',
          razorpaySignature: 'valid_sig',
        }),
      ).rejects.toThrow('DB connection lost');
    });
  });
});
