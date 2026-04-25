import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/database.service';
import { RedisService } from '../../services/redis/redis.service';
import {
  SellerProfileDto,
  SellerListItemDto,
  SellerProductsQueryDto,
  SellerListQueryDto,
} from './dto/seller-profile.dto';
import { PaginatedResponseDto, PaginationMetaDto } from '../../common/dto/pagination.dto';

const PROFILE_TTL = 60;   // seconds
const LIST_TTL    = 120;  // seconds

@Injectable()
export class SellersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getSellerProfile(sellerId: string): Promise<SellerProfileDto> {
    const cacheKey = `seller:profile:${sellerId}`;
    const cached = await this.redis.get<SellerProfileDto>(cacheKey);
    if (cached) return cached;

    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: {
        id: true, companyName: true, companyType: true,
        city: true, state: true, isVerified: true,
        hasIEC: true, kycStatus: true, createdAt: true,
      },
    });

    if (!seller || seller.kycStatus !== 'APPROVED') {
      throw new NotFoundException('Seller not found');
    }

    const [productCount, viewAgg, categories, products] = await Promise.all([
      this.prisma.product.count({
        where: { sellerId, isActive: true, adminApprovalStatus: 'APPROVED' as any },
      }),

      this.prisma.productViewTracking.aggregate({
        _sum: { viewCount: true },
        where: { product: { sellerId } },
      }),

      this.prisma.category.findMany({
        where: { productLinks: { some: { product: { sellerId, isActive: true } } } },
        select: { industryType: true },
      }),

      // select instead of include + no take:1 on nested relation → Prisma batches in 3 queries
      this.prisma.product.findMany({
        where: { sellerId, isActive: true, adminApprovalStatus: 'APPROVED' as any },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          name: true,
          images: true,
          multiTierPricing: true,
          categories: {
            select: { category: { select: { name: true } } },
          },
        },
      }),
    ]);

    const badges: string[] = [];
    if (seller.isVerified) badges.push('VERIFIED_SELLER');
    if (seller.isVerified) badges.push('GST_VERIFIED');
    if (seller.hasIEC)     badges.push('IEC_GLOBAL');

    const yearsInBusiness = Math.max(
      1,
      Math.floor((Date.now() - seller.createdAt.getTime()) / 31536000000),
    );

    const industryTypes = [
      ...new Set((categories as any[]).flatMap((c) => c.industryType as string[])),
    ];

    const cataloguePreview = (products as any[]).map((p) => ({
      id: p.id,
      name: p.name,
      images: this.toAbsoluteUrls(p.images),
      multiTierPricing: p.multiTierPricing,
      categoryName: p.categories[0]?.category?.name ?? '',
    }));

    const result: SellerProfileDto = {
      id: seller.id,
      companyName: seller.companyName,
      companyType: seller.companyType,
      city: seller.city ?? null,
      state: seller.state ?? null,
      companyInitials: seller.companyName.slice(0, 2).toUpperCase(),
      badges,
      yearsInBusiness,
      productCount,
      totalProductViews: viewAgg._sum.viewCount ?? 0,
      industryTypes,
      cataloguePreview,
    };

    await this.redis.set(cacheKey, result, PROFILE_TTL);
    return result;
  }

  async getSellerProducts(
    sellerId: string,
    query: SellerProductsQueryDto,
  ): Promise<PaginatedResponseDto<any>> {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 12;

    const where = {
      sellerId,
      isActive: true,
      adminApprovalStatus: 'APPROVED' as any,
    };

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        // select only what the UI needs + no take:1 on nested → 3 queries total, not N+1
        select: {
          id: true,
          name: true,
          images: true,
          multiTierPricing: true,
          categories: {
            select: { category: { select: { name: true } } },
          },
        },
      }),
    ]);

    const data = (products as any[]).map((p) => ({
      id: p.id,
      name: p.name,
      images: this.toAbsoluteUrls(p.images),
      multiTierPricing: p.multiTierPricing,
      categoryName: p.categories[0]?.category?.name ?? '',
    }));

    return new PaginatedResponseDto(data, new PaginationMetaDto(page, limit, total));
  }

  async getSellersList(
    query: SellerListQueryDto,
  ): Promise<PaginatedResponseDto<SellerListItemDto>> {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;

    const where: any = { isVerified: true, kycStatus: 'APPROVED' };
    if (query.search) where.companyName = { contains: query.search, mode: 'insensitive' };
    if (query.state)  where.state = query.state;

    // Cache paginated list (no user-specific data)
    const cacheKey = `sellers:list:${page}:${limit}:${query.search ?? ''}:${query.state ?? ''}`;
    const cached = await this.redis.get<PaginatedResponseDto<SellerListItemDto>>(cacheKey);
    if (cached) return cached;

    const [total, sellers] = await Promise.all([
      this.prisma.seller.count({ where }),
      this.prisma.seller.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { companyName: 'asc' },
        // select only the 7 fields needed — avoids fetching all 30+ columns
        select: {
          id: true,
          companyName: true,
          city: true,
          state: true,
          isVerified: true,
          hasIEC: true,
          createdAt: true,
          _count: {
            select: {
              products: { where: { isActive: true, adminApprovalStatus: 'APPROVED' as any } },
            },
          },
        },
      }),
    ]);

    const data: SellerListItemDto[] = (sellers as any[]).map((s) => {
      const badges: string[] = [];
      if (s.isVerified) badges.push('VERIFIED_SELLER');
      if (s.isVerified) badges.push('GST_VERIFIED');
      if (s.hasIEC)     badges.push('IEC_GLOBAL');

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

    const result = new PaginatedResponseDto(data, new PaginationMetaDto(page, limit, total));
    await this.redis.set(cacheKey, result, LIST_TTL);
    return result;
  }

  async getSitemapSellerIds(): Promise<string[]> {
    const sellers = await this.prisma.seller.findMany({
      where: { kycStatus: 'APPROVED' as any },
      select: { id: true },
    });
    return sellers.map((s) => s.id);
  }

  /** Record a unique profile view using Redis HyperLogLog (deduplicates by visitor+day) */
  async trackProfileView(sellerId: string, visitorId: string): Promise<void> {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const hllKey = `seller:views:hll:${sellerId}:${today}`;
    await this.redis.pfAdd(hllKey, visitorId);
    // Expire after 35 days so old daily buckets auto-clean
    await this.redis.expire(hllKey, 35 * 24 * 3600);
  }

  private toAbsoluteUrls(images: any): string[] {
    if (!Array.isArray(images)) return [];
    const base = process.env.BACKEND_URL ?? 'http://localhost:4001';
    return images.map((p: string) => {
      if (!p || p.startsWith('http://') || p.startsWith('https://')) return p;
      return `${base}${p.startsWith('/') ? '' : '/'}${p}`;
    });
  }

  /** Approximate unique profile views for a seller over the last N days */
  async getProfileViewCount(sellerId: string, days: number = 30): Promise<number> {
    let total = 0;
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      total += await this.redis.pfCount(`seller:views:hll:${sellerId}:${d}`);
    }
    return total;
  }
}
