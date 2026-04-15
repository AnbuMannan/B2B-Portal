import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/database.service';
import { RedisService } from '../../services/redis/redis.service';
import {
  ChangePasswordDto,
  DeactivateAccountDto,
  RE_KYC_FIELD_SET,
  UpdateSellerProfileDto,
  UpdateSellerSettingsDto,
} from './dto/seller-account.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class SellerAccountService {
  private readonly logger = new Logger(SellerAccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── GET /api/seller/profile ──────────────────────────────────────────────

  async getMyProfile(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      select: {
        id: true,
        companyName: true,
        companyType: true,
        logoUrl: true,
        businessOfficeAddress: true,
        registeredOfficeAddress: true,
        city: true,
        state: true,
        pincode: true,
        country: true,
        gstNumber: true,
        panNumber: true,
        iecCode: true,
        udyamNumber: true,
        isVerified: true,
        kycStatus: true,
        approvalDate: true,
        rejectionReason: true,
        industryType: true,
        businessModel: true,
        hasIEC: true,
        directorName: true,
        directorDesignation: true,
        aadhaarLastFour: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            phoneNumber: true,
            phoneVerified: true,
          },
        },
        kycDocuments: {
          orderBy: { uploadedAt: 'desc' },
          select: {
            id: true,
            documentType: true,
            fileUrl: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            uploadedAt: true,
          },
        },
      },
    });

    if (!seller) throw new NotFoundException('Seller profile not found');

    const badges: string[] = [];
    if (seller.isVerified)   badges.push('VERIFIED_SELLER');
    if (seller.gstNumber)    badges.push('GST_VERIFIED');
    if (seller.iecCode)      badges.push('IEC_GLOBAL');
    if (seller.udyamNumber)  badges.push('UDYAM_MSME');

    return {
      id: seller.id,
      companyName: seller.companyName,
      companyType: seller.companyType,
      logoUrl: seller.logoUrl ?? null,
      companyInitials: seller.companyName.slice(0, 2).toUpperCase(),
      badges,
      kycStatus: seller.kycStatus,
      isVerified: seller.isVerified,
      approvalDate: seller.approvalDate,
      rejectionReason: seller.rejectionReason,
      contact: {
        email: seller.user.email,
        phone: seller.user.phoneNumber ?? null,
        phoneVerified: seller.user.phoneVerified,
      },
      address: {
        businessOfficeAddress: seller.businessOfficeAddress ?? null,
        registeredOfficeAddress: seller.registeredOfficeAddress ?? null,
        city: seller.city ?? null,
        state: seller.state ?? null,
        pincode: seller.pincode ?? null,
        country: seller.country,
      },
      kyc: {
        gstNumber: seller.gstNumber ?? null,
        panNumber: seller.panNumber ?? null,
        iecCode: seller.iecCode ?? null,
        udyamNumber: seller.udyamNumber ?? null,
        industryType: seller.industryType,
        businessModel: seller.businessModel ?? null,
        hasIEC: seller.hasIEC,
        directorName: seller.directorName ?? null,
        directorDesignation: seller.directorDesignation ?? null,
        aadhaarLastFour: (seller as any).aadhaarLastFour ?? null,
      },
      documents: seller.kycDocuments,
      memberSince: seller.createdAt,
    };
  }

  // ─── PATCH /api/seller/profile ────────────────────────────────────────────

  async updateProfile(userId: string, dto: UpdateSellerProfileDto) {
    // Detect re-KYC fields in the request
    const reKycRequested = Object.keys(dto).filter((k) => RE_KYC_FIELD_SET.has(k));
    if (reKycRequested.length > 0) {
      return { requiresReKYC: true, fields: reKycRequested };
    }

    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!seller) throw new NotFoundException('Seller profile not found');

    const { phone, ...sellerFields } = dto;

    // Update seller record (only updateable fields)
    await this.prisma.seller.update({
      where: { id: seller.id },
      data: {
        ...(sellerFields.companyName !== undefined && { companyName: sellerFields.companyName }),
        ...(sellerFields.businessOfficeAddress !== undefined && {
          businessOfficeAddress: sellerFields.businessOfficeAddress,
        }),
        ...(sellerFields.city !== undefined && { city: sellerFields.city }),
        ...(sellerFields.state !== undefined && { state: sellerFields.state }),
      },
    });

    // Update phone on the User record separately
    if (phone !== undefined) {
      const existing = await this.prisma.user.findFirst({
        where: { phoneNumber: phone, NOT: { id: userId } },
      });
      if (existing) throw new BadRequestException('Phone number already in use');
      await this.prisma.user.update({
        where: { id: userId },
        data: { phoneNumber: phone, phoneVerified: false },
      });
    }

    // Bust the dashboard cache so next load is fresh
    await this.redis.delete(`dashboard:${userId}`);
    await this.redis.delete(`seller:profile:${seller.id}`);

    this.logger.log(`Seller profile updated: userId=${userId}`);
    return { updated: true };
  }

  // ─── PATCH /api/seller/profile/logo ──────────────────────────────────────
  // Called by UploadController after file processing — stores the path.

  async updateLogo(userId: string, logoUrl: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!seller) throw new NotFoundException('Seller not found');

    await this.prisma.seller.update({
      where: { id: seller.id },
      data: { logoUrl },
    });

    await this.redis.delete(`dashboard:${userId}`);
    await this.redis.delete(`seller:profile:${seller.id}`);

    return { logoUrl };
  }

  // ─── GET /api/seller/settings ─────────────────────────────────────────────

  async getSettings(userId: string) {
    let prefs = await this.prisma.notificationPreferences.findUnique({
      where: { userId },
    });

    // Auto-create default preferences on first access
    if (!prefs) {
      prefs = await this.prisma.notificationPreferences.create({
        data: { userId },
      });
    }

    return {
      notifications: {
        email: prefs.emailNotifications,
        sms: prefs.smsNotifications,
        whatsapp: prefs.whatsappNotifications,
        push: prefs.pushNotifications,
      },
      eventPreferences: (prefs.eventPreferences as any) ?? this._defaultEventPreferences(),
    };
  }

  // ─── PATCH /api/seller/settings ──────────────────────────────────────────

  async updateSettings(userId: string, dto: UpdateSellerSettingsDto) {
    const existing = await this.prisma.notificationPreferences.findUnique({
      where: { userId },
    });

    const data: any = {};
    if (dto.emailNotifications    !== undefined) data.emailNotifications    = dto.emailNotifications;
    if (dto.smsNotifications      !== undefined) data.smsNotifications      = dto.smsNotifications;
    if (dto.whatsappNotifications !== undefined) data.whatsappNotifications = dto.whatsappNotifications;
    if (dto.pushNotifications     !== undefined) data.pushNotifications     = dto.pushNotifications;
    if (dto.eventPreferences      !== undefined) data.eventPreferences      = dto.eventPreferences;

    if (existing) {
      await this.prisma.notificationPreferences.update({ where: { userId }, data });
    } else {
      await this.prisma.notificationPreferences.create({ data: { userId, ...data } });
    }

    return { updated: true };
  }

  // ─── POST /api/seller/account/change-password ────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const hash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });

    // Revoke all refresh tokens — force re-login on other devices
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    this.logger.log(`Password changed for userId=${userId}`);
    return { changed: true };
  }

  // ─── POST /api/seller/account/deactivate ─────────────────────────────────

  async deactivateAccount(userId: string, dto: DeactivateAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, isActive: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive) throw new BadRequestException('Account is already deactivated');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Password is incorrect');

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false, deletedAt: new Date() },
    });

    // Revoke all sessions
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    this.logger.warn(`Account deactivated: userId=${userId} reason=${dto.reason ?? 'none'}`);
    return { deactivated: true };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private _defaultEventPreferences() {
    const events = ['NEW_LEAD', 'NEW_ORDER', 'KYC_STATUS', 'PRODUCT_APPROVED', 'LOW_BALANCE', 'PAYMENT'];
    return Object.fromEntries(
      events.map((e) => [e, { email: true, sms: false, whatsapp: false }]),
    );
  }
}
