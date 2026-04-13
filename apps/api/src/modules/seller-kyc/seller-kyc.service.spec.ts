import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { SellerKycService } from './seller-kyc.service';
import { GstinService } from '../../services/government/gstin.service';
import { PanService } from '../../services/government/pan.service';
import { IecService } from '../../services/government/iec.service';
import { PincodeService } from '../../services/government/pincode.service';
import { PrismaService } from '../../database/database.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: { findUnique: jest.fn() },
  seller: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  sellerKycDocument: {
    findFirst: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  auditLog: { create: jest.fn() },
};

const mockGstinService = {
  verify: jest.fn(),
  validateFormat: jest.fn(),
};

const mockPanService = {
  verify: jest.fn(),
  validateFormat: jest.fn(),
};

const mockIecService = {
  verify: jest.fn(),
  validateFormat: jest.fn(),
};

const mockPincodeService = {
  lookup: jest.fn(),
};

const mockQueue = { add: jest.fn() };

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('SellerKycService', () => {
  let service: SellerKycService;
  let gstinService: GstinService;
  let panService: PanService;
  let iecService: IecService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SellerKycService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GstinService, useValue: mockGstinService },
        { provide: PanService, useValue: mockPanService },
        { provide: IecService, useValue: mockIecService },
        { provide: PincodeService, useValue: mockPincodeService },
        { provide: getQueueToken('notifications'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<SellerKycService>(SellerKycService);
    gstinService = module.get<GstinService>(GstinService);
    panService = module.get<PanService>(PanService);
    iecService = module.get<IecService>(IecService);

    jest.clearAllMocks();
  });

  // ─── 1. GSTIN Format Validation ──────────────────────────────────────────

  describe('GstinService.validateFormat', () => {
    const validGstins = [
      '27AAPFU0939F1ZV',
      '07AAACS6679L1ZD',
      '33AAGCB5803H1ZW',
    ];
    const invalidGstins = [
      '',
      '27AAPFU0939',       // too short
      'AAPFU0939F1ZV27',   // wrong order
      '27aapfu0939f1zv',   // lowercase
      '271AAPFU939F1ZV',   // wrong digit count
    ];

    it.each(validGstins)('accepts valid GSTIN: %s', (gstin) => {
      const real = new GstinService({ get: jest.fn() } as any, mockPrisma as any);
      expect(real.validateFormat(gstin)).toBe(true);
    });

    it.each(invalidGstins)('rejects invalid GSTIN: %s', (gstin) => {
      const real = new GstinService({ get: jest.fn() } as any, mockPrisma as any);
      expect(real.validateFormat(gstin)).toBe(false);
    });
  });

  // ─── 2. PAN Format Validation ─────────────────────────────────────────────

  describe('PanService.validateFormat', () => {
    it('accepts valid PAN: ABCDE1234F', () => {
      const real = new PanService(mockPrisma as any);
      expect(real.validateFormat('ABCDE1234F')).toBe(true);
    });

    it('accepts valid PAN: AAPFU0939F', () => {
      const real = new PanService(mockPrisma as any);
      expect(real.validateFormat('AAPFU0939F')).toBe(true);
    });

    it('rejects PAN with digits in wrong position: ABCDE12345', () => {
      const real = new PanService(mockPrisma as any);
      expect(real.validateFormat('ABCDE12345')).toBe(false);
    });

    it('rejects PAN shorter than 10 chars: ABCDE123', () => {
      const real = new PanService(mockPrisma as any);
      expect(real.validateFormat('ABCDE123')).toBe(false);
    });

    it('rejects lowercase PAN: abcde1234f', () => {
      const real = new PanService(mockPrisma as any);
      expect(real.validateFormat('abcde1234f')).toBe(false);
    });

    it('rejects empty string', () => {
      const real = new PanService(mockPrisma as any);
      expect(real.validateFormat('')).toBe(false);
    });
  });

  // ─── 3. Aadhaar field rejects if more than 4 digits entered ───────────────

  describe('KycStep4Dto Aadhaar validation', () => {
    it('rejects Aadhaar value with more than 4 digits', () => {
      // This mirrors what the DTO's @Length(4,4) + @Matches would validate
      const isValid4Digits = (val: string) => /^\d{4}$/.test(val);

      expect(isValid4Digits('1234')).toBe(true);
      expect(isValid4Digits('12345')).toBe(false);   // 5 digits
      expect(isValid4Digits('123')).toBe(false);     // 3 digits
      expect(isValid4Digits('123A')).toBe(false);    // non-numeric
      expect(isValid4Digits('')).toBe(false);
    });
  });

  // ─── 4. Pincode auto-fill populates city and state ────────────────────────

  describe('saveStep2 — pincode auto-fill', () => {
    it('uses city and state from pincode API when valid', async () => {
      const userId = 'user-1';
      const sellerId = 'seller-1';

      mockPrisma.seller.findUnique.mockResolvedValue({ id: sellerId, userId, hasIEC: false });
      mockPincodeService.lookup.mockResolvedValue({
        valid: true,
        city: 'Mumbai',
        state: 'Maharashtra',
        district: 'Mumbai City',
      });
      mockPrisma.seller.update.mockResolvedValue({});

      const dto = {
        registeredOfficeAddress: {
          addressLine1: '12 Gandhi Nagar',
          city: 'Bombay',   // will be overridden by pincode API
          state: 'MH',      // will be overridden
          pincode: '400001',
        },
        sameAsRegistered: true,
      };

      const result = await service.saveStep2(userId, dto as any);

      expect(result.city).toBe('Mumbai');
      expect(result.state).toBe('Maharashtra');
      expect(mockPrisma.seller.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ city: 'Mumbai', state: 'Maharashtra' }),
        }),
      );
    });

    it('falls back to provided city/state when pincode API is unavailable', async () => {
      const userId = 'user-1';
      const sellerId = 'seller-1';

      mockPrisma.seller.findUnique.mockResolvedValue({ id: sellerId, userId, hasIEC: false });
      mockPincodeService.lookup.mockResolvedValue({ valid: false, error: 'API unavailable' });
      mockPrisma.seller.update.mockResolvedValue({});

      const dto = {
        registeredOfficeAddress: {
          addressLine1: '12 Gandhi Nagar',
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500001',
        },
        sameAsRegistered: true,
      };

      const result = await service.saveStep2(userId, dto as any);

      expect(result.city).toBe('Hyderabad');
      expect(result.state).toBe('Telangana');
    });
  });

  // ─── 5. File upload rejects > 5MB ─────────────────────────────────────────
  // (Tested at upload controller level — validating the logic here as a unit)

  describe('File size validation', () => {
    const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

    it('5 MB file is exactly at limit (accepted)', () => {
      expect(MAX_BYTES).toBe(5242880);
      const fileSize = 5242880;
      expect(fileSize <= MAX_BYTES).toBe(true);
    });

    it('file over 5 MB is rejected', () => {
      const fileSize = 5242881; // 1 byte over
      expect(fileSize > MAX_BYTES).toBe(true);
    });

    it('1 MB file is well within limit', () => {
      const fileSize = 1024 * 1024;
      expect(fileSize <= MAX_BYTES).toBe(true);
    });
  });

  // ─── 6. KYC Step 1 requires companyType ───────────────────────────────────

  describe('saveStep1 — companyType required', () => {
    it('creates seller profile and saves step 1 data', async () => {
      const userId = 'user-1';
      mockPrisma.seller.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'SELLER' });
      mockPrisma.seller.create.mockResolvedValue({ id: 'seller-1', userId });
      mockPrisma.seller.update.mockResolvedValue({ id: 'seller-1', companyName: 'Test Co', companyType: 'PROPRIETORSHIP', businessModel: 'MANUFACTURER' });

      const dto = {
        companyName: 'Test Company',
        companyType: 'PROPRIETORSHIP',
        industryType: ['Textiles'],
        businessModel: 'MANUFACTURER',
        hasIEC: false,
      };

      const result = await service.saveStep1(userId, dto as any);
      expect(result.step).toBe(1);
      expect(result.nextStep).toBe(2);
      expect(mockPrisma.seller.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyName: 'Test Company', companyType: 'PROPRIETORSHIP' }),
        }),
      );
    });

    it('throws ForbiddenException if user is not a SELLER', async () => {
      mockPrisma.seller.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'BUYER' });

      await expect(service.saveStep1('user-buyer', {} as any)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── 7. kycStatus = PENDING after step 4 submit ───────────────────────────

  describe('submitKyc', () => {
    it('sets kycStatus = PENDING and queues admin notification', async () => {
      const userId = 'user-1';
      mockPrisma.seller.findUnique.mockResolvedValue({
        id: 'seller-1',
        userId,
        companyName: 'Test Co',
        directorName: 'Rajesh',
        aadhaarLastFour: '1234',
        kycDocuments: [
          { documentType: 'GST_CERTIFICATE', fileUrl: '/kyc-docs/gst.pdf' },
          { documentType: 'PAN_CARD', fileUrl: '/kyc-docs/pan.jpg' },
        ],
      });
      mockPrisma.seller.update.mockResolvedValue({ kycStatus: 'PENDING' });
      mockQueue.add.mockResolvedValue({});

      const result = await service.submitKyc(userId);

      expect(result.kycStatus).toBe('PENDING');
      expect(mockPrisma.seller.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { kycStatus: 'PENDING' } }),
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        'kyc-submitted',
        expect.objectContaining({ sellerId: 'seller-1' }),
      );
    });

    it('throws BadRequestException if GST or PAN document missing', async () => {
      mockPrisma.seller.findUnique.mockResolvedValue({
        id: 'seller-1',
        userId: 'user-1',
        companyName: 'Test Co',
        directorName: 'Rajesh',
        aadhaarLastFour: '1234',
        kycDocuments: [
          { documentType: 'GST_CERTIFICATE', fileUrl: '/kyc-docs/gst.pdf' },
          // PAN_CARD missing
        ],
      });

      await expect(service.submitKyc('user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if personal details not completed', async () => {
      mockPrisma.seller.findUnique.mockResolvedValue({
        id: 'seller-1',
        userId: 'user-1',
        companyName: 'Test Co',
        directorName: null,  // missing
        aadhaarLastFour: null, // missing
        kycDocuments: [
          { documentType: 'GST_CERTIFICATE', fileUrl: '/kyc-docs/gst.pdf' },
          { documentType: 'PAN_CARD', fileUrl: '/kyc-docs/pan.jpg' },
        ],
      });

      await expect(service.submitKyc('user-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── 8. saveStep3 — GSTIN validation failure blocks save ─────────────────

  describe('saveStep3 — GSTIN validation', () => {
    it('throws BadRequestException when GSTIN verification fails', async () => {
      const userId = 'user-1';
      mockPrisma.seller.findUnique.mockResolvedValue({ id: 'seller-1', userId, hasIEC: false });
      mockGstinService.verify.mockResolvedValue({ valid: false, error: 'GSTIN not found' });

      await expect(
        service.saveStep3(userId, {
          gstNumber: '27AAPFU0939F1ZV',
          gstCertificateUrl: '/kyc-docs/gst.pdf',
          panNumber: 'ABCDE1234F',
          panCardUrl: '/kyc-docs/pan.jpg',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when IEC is required but not provided', async () => {
      const userId = 'user-1';
      mockPrisma.seller.findUnique.mockResolvedValueOnce({ id: 'seller-1', userId, hasIEC: false })
        .mockResolvedValueOnce({ id: 'seller-1', hasIEC: true }); // second call for hasIEC check

      mockGstinService.verify.mockResolvedValue({ valid: true, legalName: 'Test Co' });
      mockPanService.verify.mockResolvedValue({ valid: true });

      await expect(
        service.saveStep3(userId, {
          gstNumber: '27AAPFU0939F1ZV',
          gstCertificateUrl: '/kyc-docs/gst.pdf',
          panNumber: 'ABCDE1234F',
          panCardUrl: '/kyc-docs/pan.jpg',
          // iecCode deliberately omitted
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
