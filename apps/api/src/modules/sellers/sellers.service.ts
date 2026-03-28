import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/database.service';
import {
  SellerProfileDto,
  SellerListItemDto,
  SellerProductsQueryDto,
  SellerListQueryDto,
} from './dto/seller-profile.dto';
import { PaginatedResponseDto, PaginationMetaDto } from '../../common/dto/pagination.dto';

@Injectable()
export class SellersService {
  constructor(private readonly prisma: PrismaService) {}

  async getSellerProfile(sellerId: string): Promise<SellerProfileDto> {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller || (seller as any).kycStatus !== 'APPROVED') {
      throw new NotFoundException('Seller not found');
    }

    const [productCount, viewAgg, categories, products] = await Promise.all([
      this.prisma.product.count({
        where: {
          sellerId,
          isActive: true,
          adminApprovalStatus: 'APPROVED' as any,
        },
      }),

      this.prisma.productViewTracking.aggregate({
        _sum: { viewCount: true },
        where: { product: { sellerId } },
      }),

      this.prisma.category.findMany({
        where: {
          productLinks: {
            some: { product: { sellerId, isActive: true } },
          },
        },
        select: { industryType: true },
      }),

      this.prisma.product.findMany({
        where: {
          sellerId,
          isActive: true,
          adminApprovalStatus: 'APPROVED' as any,
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          categories: {
            include: { category: true },
            take: 1,
          },
        },
      }),
    ]);

    const badges: string[] = [];
    if ((seller as any).isVerified) badges.push('VERIFIED_SELLER');
    if ((seller as any).gstNumber) badges.push('GST_VERIFIED');
    if ((seller as any).iecCode) badges.push('IEC_GLOBAL');

    const yearsInBusiness = Math.max(
      1,
      Math.floor((Date.now() - (seller as any).createdAt.getTime()) / 31536000000),
    );

    const industryTypes = [
      ...new Set((categories as any[]).flatMap((c) => c.industryType as string[])),
    ];

    const cataloguePreview = (products as any[]).map((p) => ({
      id: p.id,
      name: p.name,
      images: p.images,
      multiTierPricing: p.multiTierPricing,
      categoryName: p.categories[0]?.category?.name ?? '',
    }));

    return {
      id: seller.id,
      companyName: (seller as any).companyName,
      companyType: (seller as any).companyType,
      city: (seller as any).city ?? null,
      state: (seller as any).state ?? null,
      companyInitials: (seller as any).companyName.slice(0, 2).toUpperCase(),
      badges,
      yearsInBusiness,
      productCount,
      totalProductViews: viewAgg._sum.viewCount ?? 0,
      industryTypes,
      cataloguePreview,
    };
  }

  async getSellerProducts(
    sellerId: string,
    query: SellerProductsQueryDto,
  ): Promise<PaginatedResponseDto<any>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const sortBy = query.sortBy ?? 'newest';

    const where = {
      sellerId,
      isActive: true,
      adminApprovalStatus: 'APPROVED' as any,
    };

    const orderBy = sortBy === 'price-asc' || sortBy === 'price-desc'
      ? { createdAt: 'desc' as const }
      : { createdAt: 'desc' as const };

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          categories: {
            include: { category: true },
            take: 1,
          },
        },
      }),
    ]);

    const data = (products as any[]).map((p) => ({
      id: p.id,
      name: p.name,
      images: p.images,
      multiTierPricing: p.multiTierPricing,
      categoryName: p.categories[0]?.category?.name ?? '',
    }));

    return new PaginatedResponseDto(data, new PaginationMetaDto(page, limit, total));
  }

  async getSellersList(
    query: SellerListQueryDto,
  ): Promise<PaginatedResponseDto<SellerListItemDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: any = {
      isVerified: true,
      kycStatus: 'APPROVED',
    };

    if (query.search) {
      where.companyName = { contains: query.search, mode: 'insensitive' };
    }
    if (query.state) {
      where.state = query.state;
    }

    const [total, sellers] = await Promise.all([
      this.prisma.seller.count({ where }),
      this.prisma.seller.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { companyName: 'asc' },
        include: {
          _count: {
            select: {
              products: {
                where: { isActive: true, adminApprovalStatus: 'APPROVED' as any },
              },
            },
          },
        },
      }),
    ]);

    const data: SellerListItemDto[] = (sellers as any[]).map((s) => {
      const badges: string[] = [];
      if (s.isVerified) badges.push('VERIFIED_SELLER');
      if (s.gstNumber) badges.push('GST_VERIFIED');
      if (s.iecCode) badges.push('IEC_GLOBAL');

      return {
        id: s.id,
        companyName: s.companyName,
        city: s.city ?? null,
        state: s.state ?? null,
        companyInitials: s.companyName.slice(0, 2).toUpperCase(),
        badges,
        productCount: s._count.products,
        yearsInBusiness: Math.max(
          1,
          Math.floor((Date.now() - s.createdAt.getTime()) / 31536000000),
        ),
      };
    });

    return new PaginatedResponseDto(data, new PaginationMetaDto(page, limit, total));
  }
}
