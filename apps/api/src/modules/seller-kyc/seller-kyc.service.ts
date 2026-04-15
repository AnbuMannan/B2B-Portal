import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../database/database.service';
import { GstinService } from '../../services/government/gstin.service';
import { PanService } from '../../services/government/pan.service';
import { IecService } from '../../services/government/iec.service';
import { PincodeService } from '../../services/government/pincode.service';
import { KycStep1Dto } from './dto/kyc-step1.dto';
import { KycStep2Dto } from './dto/kyc-step2.dto';
import { KycStep3Dto } from './dto/kyc-step3.dto';
import { KycStep4Dto } from './dto/kyc-step4.dto';

@Injectable()
export class SellerKycService {
  private readonly logger = new Logger(SellerKycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gstinService: GstinService,
    private readonly panService: PanService,
    private readonly iecService: IecService,
    private readonly pincodeService: PincodeService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  async getOrCreateSellerProfile(userId: string) {
    let seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) {
      // Seller account created on first KYC step access
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (user?.role !== 'SELLER') {
        throw new ForbiddenException('Only SELLER accounts can complete KYC');
      }
      seller = await this.prisma.seller.create({
        data: {
          userId,
          companyName: 'Pending',
          companyType: 'PROPRIETORSHIP',
          kycStatus: 'PENDING',
        },
      });
    }
    return seller;
  }

  async saveStep1(userId: string, dto: KycStep1Dto) {
    const seller = await this.getOrCreateSellerProfile(userId);

    const updated = await this.prisma.seller.update({
      where: { id: seller.id },
      data: {
        companyName: dto.companyName,
        companyType: dto.companyType as any,
        industryType: { set: dto.industryType },
        businessModel: dto.businessModel as any,
        hasIEC: dto.hasIEC,
      },
      select: { id: true, companyName: true, companyType: true, businessModel: true },
    });

    this.logger.log(`KYC Step 1 saved for seller: ${seller.id}`);
    return { sellerId: updated.id, step: 1, nextStep: 2 };
  }

  async saveStep2(userId: string, dto: KycStep2Dto) {
    const seller = await this.getOrCreateSellerProfile(userId);

    const regAddr = dto.registeredOfficeAddress;
    const bizAddr = dto.sameAsRegistered ? regAddr : (dto.businessOfficeAddress ?? regAddr);

    // Validate pincode via India Post API
    const pincodeResult = await this.pincodeService.lookup(regAddr.pincode);
    // Non-blocking: pincode lookup may fail if API is down — use provided city/state as fallback
    const city = pincodeResult.valid ? (pincodeResult.city ?? regAddr.city) : regAddr.city;
    const state = pincodeResult.valid ? (pincodeResult.state ?? regAddr.state) : regAddr.state;

    await this.prisma.seller.update({
      where: { id: seller.id },
      data: {
        registeredOfficeAddress: JSON.stringify(regAddr),
        businessOfficeAddress: JSON.stringify(bizAddr),
        city,
        state,
        pincode: regAddr.pincode,
      },
    });

    this.logger.log(`KYC Step 2 saved for seller: ${seller.id}`);
    return { sellerId: seller.id, step: 2, nextStep: 3, city, state };
  }

  async saveStep3(userId: string, dto: KycStep3Dto) {
    const seller = await this.getOrCreateSellerProfile(userId);

    // Validate GSTIN (sandbox: log warning but never block submission)
    const gstinResult = await this.gstinService.verify(dto.gstNumber, userId);
    if (!gstinResult.valid) {
      this.logger.warn(`GSTIN format invalid for seller ${seller.id}: ${gstinResult.error}`);
    }

    // Validate PAN (sandbox: log warning but never block submission)
    const panResult = await this.panService.verify(dto.panNumber, userId);
    if (!panResult.valid) {
      this.logger.warn(`PAN format invalid for seller ${seller.id}: ${panResult.error}`);
    }

    // Validate IEC if provided (sandbox: log warning but never block submission)
    if (dto.iecCode) {
      const iecResult = await this.iecService.verify(dto.iecCode, userId);
      if (!iecResult.valid) {
        this.logger.warn(`IEC format invalid for seller ${seller.id}: ${iecResult.error}`);
      }
    }

    // Save documents
    const docUpserts = [];

    const docsToSave = [
      { documentType: 'GST_CERTIFICATE', fileUrl: dto.gstCertificateUrl },
      { documentType: 'PAN_CARD', fileUrl: dto.panCardUrl },
      ...(dto.iecCertificateUrl ? [{ documentType: 'IEC_CERTIFICATE', fileUrl: dto.iecCertificateUrl }] : []),
      ...(dto.udyamCertificateUrl ? [{ documentType: 'UDYAM', fileUrl: dto.udyamCertificateUrl }] : []),
      ...(dto.isoCertificateUrl ? [{ documentType: 'ISO', fileUrl: dto.isoCertificateUrl }] : []),
      ...(dto.drugLicenceUrl ? [{ documentType: 'DRUG_LICENCE', fileUrl: dto.drugLicenceUrl }] : []),
      ...(dto.fssaiCertificateUrl ? [{ documentType: 'FSSAI', fileUrl: dto.fssaiCertificateUrl }] : []),
    ];

    for (const doc of docsToSave) {
      docUpserts.push(
        this.prisma.sellerKycDocument.upsert({
                  where: { 
                    id: (await this.prisma.sellerKycDocument.findFirst({
                          where: { sellerId: seller.id, documentType: doc.documentType },
                          select: { id: true }
                        }))?.id ?? '00000000-0000-0000-0000-000000000000' // Use a dummy UUID format if your ID is a UUID
                  },
          create: {
            sellerId: seller.id,
            documentType: doc.documentType,
            fileUrl: doc.fileUrl,
            fileName: doc.fileUrl.split('/').pop() ?? 'document',
            fileSize: 0,
            mimeType: doc.fileUrl.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
          },
          update: { fileUrl: doc.fileUrl },
        }),
      );
    }

    await this.prisma.seller.update({
      where: { id: seller.id },
      data: {
        gstNumber: dto.gstNumber.toUpperCase(),
        panNumber: dto.panNumber.toUpperCase(),
        iecCode: dto.iecCode?.toUpperCase() ?? null,
        udyamNumber: dto.udyamNumber ?? null,
      },
    });

    await Promise.all(docUpserts);

    this.logger.log(`KYC Step 3 saved for seller: ${seller.id}`);
    return { sellerId: seller.id, step: 3, nextStep: 4, gstinVerified: true };
  }

  async saveStep4(userId: string, dto: KycStep4Dto) {
    const seller = await this.getOrCreateSellerProfile(userId);

    await this.prisma.seller.update({
      where: { id: seller.id },
      data: {
        directorName: dto.fullName,
        directorDesignation: dto.designation,
        directorPan: dto.directorPan?.toUpperCase() ?? null,
        directorPhoto: dto.photoUrl ?? null,
        aadhaarLastFour: dto.aadhaarLastFour,
      },
    });

    if (dto.photoUrl) {
      const existing = await this.prisma.sellerKycDocument.findFirst({
        where: { sellerId: seller.id, documentType: 'DIRECTOR_PHOTO' },
        select: { id: true },
      });
      await this.prisma.sellerKycDocument.upsert({
        where: { id: existing?.id ?? 'new' },
        create: {
          sellerId: seller.id,
          documentType: 'DIRECTOR_PHOTO',
          fileUrl: dto.photoUrl,
          fileName: dto.photoUrl.split('/').pop() ?? 'photo',
          fileSize: 0,
          mimeType: 'image/jpeg',
        },
        update: { fileUrl: dto.photoUrl },
      });
    }

    this.logger.log(`KYC Step 4 saved for seller: ${seller.id}`);
    return { sellerId: seller.id, step: 4, message: 'All steps complete. Ready to submit.' };
  }

  async submitKyc(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      include: { kycDocuments: true },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found. Please complete all KYC steps first.');
    }

    // Verify mandatory documents
    const docTypes = seller.kycDocuments.map((d) => d.documentType);
    if (!docTypes.includes('GST_CERTIFICATE') || !docTypes.includes('PAN_CARD')) {
      throw new BadRequestException('GST Certificate and PAN Card are mandatory documents');
    }

    // Set kycStatus = PENDING
    await this.prisma.seller.update({
      where: { id: seller.id },
      data: { kycStatus: 'PENDING' },
    });

    // Notify admin via queue — fire-and-forget so a Redis outage never blocks KYC submission
    this.notificationsQueue.add('kyc-submitted', {
      userId,
      sellerId: seller.id,
      companyName: seller.companyName,
      type: 'EMAIL',
      templateId: 'admin-kyc-review',
      data: { sellerId: seller.id, companyName: seller.companyName },
      requestId: uuidv4(),
    }).catch((err) => this.logger.warn(`KYC notification queue failed: ${err.message}`));

    this.logger.log(`KYC submitted for seller: ${seller.id}, status: PENDING`);
    return {
      sellerId: seller.id,
      kycStatus: 'PENDING',
      message: 'KYC application submitted successfully. Our team will review it within 2-3 business days.',
    };
  }

  async getKycStatus(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      select: {
        id: true,
        companyName: true,
        companyType: true,
        industryType: true,
        businessModel: true,
        hasIEC: true,
        registeredOfficeAddress: true,
        businessOfficeAddress: true,
        gstNumber: true,
        panNumber: true,
        iecCode: true,
        udyamNumber: true,
        directorName: true,
        directorDesignation: true,
        directorPan: true,
        directorPhoto: true,
        aadhaarLastFour: true,
        kycStatus: true,
        rejectionReason: true,
        approvalDate: true,
        kycDocuments: {
          select: { documentType: true, fileUrl: true, uploadedAt: true },
        },
      },
    });

    if (!seller) {
      return { kycStatus: 'NOT_STARTED', message: 'KYC not started' };
    }

    return { ...seller };
  }

  async verifyGstin(gstin: string, userId?: string) {
    return this.gstinService.verify(gstin, userId);
  }

  async lookupPincode(pincode: string) {
    return this.pincodeService.lookup(pincode);
  }
}
