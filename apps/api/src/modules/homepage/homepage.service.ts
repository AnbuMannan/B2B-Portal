import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/database.service';
import { RedisService } from '../../services/redis/redis.service';
import { HeroDataDto, CategoriesDto, FeaturedSellersDto, LatestBuyLeadsDto } from './dto/homepage.dto';

@Injectable()
export class HomepageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getHeroData(): Promise<HeroDataDto> {
    try {
      const [gstVerifiedCount, iecGlobalCount, msmeCount, totalSellers] =
        await Promise.all([
          this.prisma.seller.count({
            where: { gstNumber: { not: null } },
          }),
          this.prisma.seller.count({
            where: { iecCode: { not: null } },
          }),
          this.prisma.seller.count({ where: { isVerified: true } }),
          this.prisma.seller.count(),
        ]);

      return {
        trustMetrics: [
          {
            label: 'GST Verified Sellers',
            value: `${gstVerifiedCount}+`,
            icon: 'gst-verified',
          },
          {
            label: 'IEC Global Exporters',
            value: `${iecGlobalCount}+`,
            icon: 'global-export',
          },
          {
            label: 'MSME Registered',
            value: `${msmeCount}+`,
            icon: 'msme',
          },
          {
            label: 'Total Verified Sellers',
            value: `${totalSellers}+`,
            icon: 'verified',
          },
        ],
      };
    } catch (err) {
      return {
        trustMetrics: [
          { label: 'Verified Sellers', value: '50K+', icon: 'gst-verified' },
          { label: 'IEC Global Exporters', value: '5K+', icon: 'global-export' },
          { label: 'MSME Registered', value: '15K+', icon: 'msme' },
          { label: 'Products Listed', value: '100K+', icon: 'verified' },
        ],
      };
    }
  }

  async getCategories(): Promise<CategoriesDto> {
    const cacheKey = 'homepage:categories';
    const cached = await this.redis.get<CategoriesDto>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const categories = await this.prisma.category.findMany({
        where: { parentId: null },
        include: {
          children: {
            include: {
              children: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      const result = this.buildCategoryTree(categories);
      await this.redis.set(cacheKey, result, 24 * 60 * 60);
      return result;
    } catch (err) {
      return { categories: [] };
    }
  }

  private buildCategoryTree(categories: any[]): CategoriesDto {
    return {
      categories: categories.map(category => ({
        id: category.id,
        name: category.name,
        industryType: category.industryType,
        children: category.children ? this.buildCategoryTree(category.children).categories : [],
      })),
    };
  }

  async getFeaturedSellers(): Promise<FeaturedSellersDto> {
    try {
      const featuredSellers = await this.prisma.seller.findMany({
        where: {
          isVerified: true,
        },
        include: {
          products: {
            where: { isActive: true },
          },
        },
        take: 8,
        orderBy: [
          { isVerified: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      const sellers = featuredSellers.map((seller: any) => {
        const badges: any[] = [];

        if (seller.gstNumber) {
          badges.push({ type: 'GST_VERIFIED', label: 'GST Verified' });
        }
        if (seller.iecCode) {
          badges.push({ type: 'IEC_GLOBAL', label: 'IEC Global' });
        }
        if (seller.isVerified && badges.length === 0) {
          badges.push({ type: 'VERIFIED_SELLER', label: 'Verified Seller' });
        }

        const yearsInBusiness = seller.createdAt
          ? Math.floor(
              (new Date().getTime() - seller.createdAt.getTime()) /
                (1000 * 60 * 60 * 24 * 365),
            )
          : 1;

        return {
          id: seller.id,
          companyName: seller.companyName,
          logoUrl: undefined,
          badges,
          productCount: seller.products.length,
          yearsInBusiness: Math.max(1, yearsInBusiness),
        };
      });

      return { sellers };
    } catch (err) {
      return { sellers: [] };
    }
  }

  async getLatestBuyLeads(): Promise<LatestBuyLeadsDto> {
    const cacheKey = 'homepage:latest-buy-leads';

    const cached = await this.redis.get<LatestBuyLeadsDto>(cacheKey);
    if (cached) return cached;

    try {
      const buyLeads = await this.prisma.buyLead.findMany({
        where: { isOpen: true },
        include: {
          buyer: {
            include: {
              user: true,
            },
          },
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });

      const leads = buyLeads.map((lead: any) => {
        const qty =
          lead.quantity != null
            ? String(parseFloat(String(lead.quantity)))
            : lead.quantityRequired != null
            ? String(lead.quantityRequired)
            : null;

        return {
          productName: lead.productName,
          quantity: qty ? `${qty} units` : 'Quantity on request',
          country: lead.expectedCountry || 'India',
          flag: this.getCountryFlag(lead.expectedCountry || 'India'),
        };
      });

      const result = { leads };
      await this.redis.set(cacheKey, result, 5 * 60);
      return result;
    } catch (err) {
      return { leads: [] };
    }
  }

  private getCountryFlag(country: string): string {
    const flagMap: Record<string, string> = {
      'India': '🇮🇳',
      'USA': '🇺🇸',
      'UK': '🇬🇧',
      'Germany': '🇩🇪',
      'France': '🇫🇷',
      'Japan': '🇯🇵',
      'China': '🇨🇳',
      'Australia': '🇦🇺',
      'Canada': '🇨🇦',
      'UAE': '🇦🇪',
    };
    
    return flagMap[country] || '🌍';
  }
}
