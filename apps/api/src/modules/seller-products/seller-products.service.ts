import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/database.service';
import { CreateSellerProductDto, UpdateSellerProductDto } from './dto/seller-products.dto';

// Critical fields whose change resets an approved product back to PENDING review
const CRITICAL_FIELDS = ['name', 'hsnCode', 'multiTierPricing', 'images'] as const;

@Injectable()
export class SellerProductsService {
  private readonly logger = new Logger(SellerProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Resolve sellerId from userId, ensuring KYC is approved */
  private async getVerifiedSeller(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      select: { id: true, kycStatus: true, isVerified: true },
    });

    if (!seller) {
      throw new ForbiddenException('Seller profile not found. Complete KYC first.');
    }

    if (seller.kycStatus !== 'APPROVED') {
      throw new ForbiddenException('KYC must be approved before managing products.');
    }

    return seller;
  }

  async create(userId: string, dto: CreateSellerProductDto) {
    const seller = await this.getVerifiedSeller(userId);

    // Validate at least one pricing tier is enabled
    const pricing = dto.multiTierPricing;
    const hasEnabledTier =
      pricing.retail?.enabled || pricing.wholesale?.enabled || pricing.bulk?.enabled;
    if (!hasEnabledTier) {
      throw new BadRequestException('At least one pricing tier must be enabled.');
    }

    const product = await this.prisma.product.create({
      data: {
        sellerId: seller.id,
        name: dto.name,
        description: dto.description ?? null,
        hsnCode: dto.hsnCode ?? null,
        unit: dto.unit ?? null,
        multiTierPricing: dto.multiTierPricing as any,
        images: (dto.images ?? []) as any,
        certifications: (dto.certifications ?? []) as any,
        countryOfOrigin: dto.countryOfOrigin ?? 'India',
        availabilityStatus: dto.availabilityStatus ?? 'IN_STOCK',
        adminApprovalStatus: dto.isDraft ? 'PENDING' : 'PENDING', // always PENDING until admin approves
        isActive: true,
        ...(dto.categoryIds?.length
          ? {
              categories: {
                create: dto.categoryIds.map((categoryId) => ({ categoryId })),
              },
            }
          : {}),
      },
      include: {
        categories: { include: { category: { select: { id: true, name: true } } } },
      },
    });

    this.logger.log(`Product created: ${product.id} by seller ${seller.id}`);
    return this.formatProduct(product);
  }

  async findAll(
    userId: string,
    filters: {
      status?: string;
      isActive?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    const seller = await this.getVerifiedSeller(userId);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = { sellerId: seller.id };
    if (filters.status) where.adminApprovalStatus = filters.status;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          categories: { include: { category: { select: { id: true, name: true } } } },
          viewTracking: { select: { viewCount: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      products: products.map(this.formatProduct),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(userId: string, productId: string) {
    const seller = await this.getVerifiedSeller(userId);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId: seller.id },
      include: {
        categories: { include: { category: { select: { id: true, name: true } } } },
        viewTracking: { select: { viewCount: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.formatProduct(product);
  }

  async update(userId: string, productId: string, dto: UpdateSellerProductDto) {
    const seller = await this.getVerifiedSeller(userId);

    const existing = await this.prisma.product.findFirst({
      where: { id: productId, sellerId: seller.id },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    // If product was APPROVED and a critical field changed → reset to PENDING
    let resetApproval = false;
    if (existing.adminApprovalStatus === 'APPROVED') {
      for (const field of CRITICAL_FIELDS) {
        if (dto[field] !== undefined) {
          resetApproval = true;
          break;
        }
      }
    }

    // Validate pricing if provided
    if (dto.multiTierPricing) {
      const pricing = dto.multiTierPricing;
      const hasEnabledTier =
        pricing.retail?.enabled || pricing.wholesale?.enabled || pricing.bulk?.enabled;
      if (!hasEnabledTier) {
        throw new BadRequestException('At least one pricing tier must be enabled.');
      }
    }

    // Handle category updates
    if (dto.categoryIds !== undefined) {
      await this.prisma.productCategory.deleteMany({ where: { productId } });
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.hsnCode !== undefined && { hsnCode: dto.hsnCode }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.multiTierPricing !== undefined && { multiTierPricing: dto.multiTierPricing as any }),
        ...(dto.images !== undefined && { images: dto.images as any }),
        ...(dto.certifications !== undefined && { certifications: dto.certifications as any }),
        ...(dto.countryOfOrigin !== undefined && { countryOfOrigin: dto.countryOfOrigin }),
        ...(dto.availabilityStatus !== undefined && { availabilityStatus: dto.availabilityStatus }),
        ...(resetApproval && { adminApprovalStatus: 'PENDING' }),
        ...(dto.categoryIds?.length
          ? {
              categories: {
                create: dto.categoryIds.map((categoryId) => ({ categoryId })),
              },
            }
          : {}),
      },
      include: {
        categories: { include: { category: { select: { id: true, name: true } } } },
        viewTracking: { select: { viewCount: true } },
      },
    });

    if (resetApproval) {
      this.logger.log(`Product ${productId} reset to PENDING after critical field change`);
    }

    return this.formatProduct(updated);
  }

  async deactivate(userId: string, productId: string) {
    const seller = await this.getVerifiedSeller(userId);

    const existing = await this.prisma.product.findFirst({
      where: { id: productId, sellerId: seller.id },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });

    this.logger.log(`Product deactivated: ${productId} by seller ${seller.id}`);
    return { productId, isActive: false };
  }

  async reactivate(userId: string, productId: string) {
    const seller = await this.getVerifiedSeller(userId);

    const existing = await this.prisma.product.findFirst({
      where: { id: productId, sellerId: seller.id },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { isActive: true },
    });

    this.logger.log(`Product reactivated: ${productId} by seller ${seller.id}`);
    return { productId, isActive: true };
  }

  async getCategories() {
    return this.prisma.category.findMany({
      select: { id: true, name: true, parentId: true, description: true },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });
  }

  private formatProduct(product: any) {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      hsnCode: product.hsnCode,
      unit: product.unit,
      multiTierPricing: product.multiTierPricing,
      images: product.images ?? [],
      certifications: product.certifications ?? [],
      countryOfOrigin: product.countryOfOrigin,
      availabilityStatus: product.availabilityStatus,
      isActive: product.isActive,
      adminApprovalStatus: product.adminApprovalStatus,
      approvalDate: product.approvalDate,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      categories: (product.categories ?? []).map((pc: any) => pc.category),
      viewCount: product.viewTracking?.viewCount ?? 0,
    };
  }
}
