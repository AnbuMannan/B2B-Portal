import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../database/database.service';
import { RedisService } from '../../../services/redis/redis.service';

export type AnalyticsPeriod = '7d' | '30d' | '90d';

// ─── Internal types for raw query results ─────────────────────────────────────

type CategoryRow = { category: string; count: bigint };
type CountryRow  = { country: string; count: bigint };

@Injectable()
export class SellerAnalyticsService {
  private readonly logger = new Logger(SellerAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── Main analytics aggregation ───────────────────────────────────────────

  async getAnalytics(userId: string, period: AnalyticsPeriod) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!seller) throw new ForbiddenException('Seller profile not found');

    const cacheKey = `analytics:${seller.id}:${period}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return { ...cached, fromCache: true };

    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const since    = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      productViewAgg,
      leadsRevealedCount,
      leadsConvertedCount,
      leadsRevealTrend,
      topProducts,
      enquiriesByCategory,
      buyerCountries,
      creditSpentAgg,
      creditPurchasedAgg,
      wallet,
      totalRevealedEver,
      totalConvertedEver,
    ] = await Promise.all([
      // ── Product views total (lifetime aggregate from ProductViewTracking) ──
      this.prisma.productViewTracking.aggregate({
        _sum: { viewCount: true },
        where: { product: { sellerId: seller.id } },
      }),

      // ── Leads revealed in period ──────────────────────────────────────────
      this.prisma.leadContactReveal.count({
        where: { sellerId: seller.id, createdAt: { gte: since } },
      }),

      // ── Leads converted in period ─────────────────────────────────────────
      this.prisma.leadContactReveal.count({
        where: { sellerId: seller.id, convertedToOrder: true, createdAt: { gte: since } },
      }),

      // ── Daily reveal timestamps (only real time-series available) ─────────
      // ProductViewTracking has no per-day rows; reveals are our engagement proxy.
      this.prisma.leadContactReveal.findMany({
        where: { sellerId: seller.id, createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),

      // ── Top 5 products by view count ──────────────────────────────────────
      this.prisma.productViewTracking.findMany({
        where: { product: { sellerId: seller.id } },
        orderBy: { viewCount: 'desc' },
        take: 5,
        include: {
          product: { select: { id: true, name: true } },
        },
      }),

      // ── Enquiries grouped by category (from reveals in period) ────────────
      this.prisma.$queryRaw<CategoryRow[]>`
        SELECT COALESCE(c."name", 'Uncategorized') AS category,
               COUNT(*)::bigint                    AS count
        FROM   "LeadContactReveal" lcr
        JOIN   "BuyLead"  bl ON bl."id"         = lcr."buyLeadId"
        LEFT JOIN "Category" c ON c."id"        = bl."categoryId"
        WHERE  lcr."sellerId" = ${seller.id}
          AND  lcr."createdAt" >= ${since}
        GROUP  BY c."name"
        ORDER  BY count DESC
        LIMIT  8
      `,

      // ── Buyer country distribution from revealed leads (geographic proxy) ─
      this.prisma.$queryRaw<CountryRow[]>`
        SELECT COALESCE(bl."expectedCountry", 'Unknown') AS country,
               COUNT(*)::bigint                          AS count
        FROM   "LeadContactReveal" lcr
        JOIN   "BuyLead" bl ON bl."id" = lcr."buyLeadId"
        WHERE  lcr."sellerId" = ${seller.id}
        GROUP  BY bl."expectedCountry"
        ORDER  BY count DESC
        LIMIT  20
      `,

      // ── Credits spent in last 30 d (fixed window for burn-rate calc) ──────
      this.prisma.leadCreditTransaction.aggregate({
        _sum: { credits: true },
        where: {
          sellerId: seller.id,
          type: 'SPEND',
          status: 'COMPLETED',
          createdAt: { gte: since30d },
        },
      }),

      // ── Credits purchased in last 30 d ────────────────────────────────────
      this.prisma.leadCreditTransaction.aggregate({
        _sum: { credits: true },
        where: {
          sellerId: seller.id,
          type: 'PURCHASE',
          status: 'COMPLETED',
          createdAt: { gte: since30d },
        },
      }),

      // ── Current wallet balance ────────────────────────────────────────────
      this.prisma.leadCreditWallet.findUnique({
        where: { sellerId: seller.id },
        select: { balance: true },
      }),

      // ── All-time conversion stats ─────────────────────────────────────────
      this.prisma.leadContactReveal.count({ where: { sellerId: seller.id } }),
      this.prisma.leadContactReveal.count({
        where: { sellerId: seller.id, convertedToOrder: true },
      }),
    ]);

    // ── Build daily engagement trend ────────────────────────────────────────
    const trendMap = new Map<string, number>();
    leadsRevealTrend.forEach((r) => {
      const d = r.createdAt.toISOString().slice(0, 10);
      trendMap.set(d, (trendMap.get(d) ?? 0) + 1);
    });

    const trend: { date: string; reveals: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      trend.push({ date: d, reveals: trendMap.get(d) ?? 0 });
    }

    // ── Credit depletion projection ─────────────────────────────────────────
    const spent30d      = creditSpentAgg._sum.credits ?? 0;
    const purchased30d  = creditPurchasedAgg._sum.credits ?? 0;
    const balance       = wallet ? Number(wallet.balance) : 0;
    const dailyBurnRate = spent30d > 0 ? spent30d / 30 : 0;
    const daysToDepletion =
      dailyBurnRate > 0 ? Math.max(0, Math.floor(balance / dailyBurnRate)) : null;
    const depletionDate =
      daysToDepletion != null
        ? new Date(Date.now() + daysToDepletion * 24 * 60 * 60_000)
            .toISOString()
            .slice(0, 10)
        : null;

    const result = {
      period,
      generatedAt: new Date().toISOString(),

      // ── Engagement trend (lead reveals per day — only time-series available)
      engagementTrend: trend,

      // ── Product views (aggregate — ProductViewTracking has no daily rows) ──
      productViews: {
        total: productViewAgg._sum.viewCount ?? 0,
      },

      // ── Seller profile unique views (Redis HLL, deduped by IP per day) ───
      profileViews: {
        total: await this._getProfileViewCount(seller.id, days),
      },

      // ── Lead stats ────────────────────────────────────────────────────────
      leadsViewed: {
        total:          leadsRevealedCount,
        converted:      leadsConvertedCount,
        conversionRate:
          leadsRevealedCount > 0
            ? Math.round((leadsConvertedCount / leadsRevealedCount) * 100)
            : 0,
      },

      // ── All-time conversion (for dashboard stat) ───────────────────────────
      allTimeConversion: {
        totalReveals:   totalRevealedEver,
        converted:      totalConvertedEver,
        conversionRate:
          totalRevealedEver > 0
            ? Math.round((totalConvertedEver / totalRevealedEver) * 100)
            : 0,
      },

      // ── Top 5 products by view count ───────────────────────────────────────
      topProducts: topProducts.map((p) => ({
        productId: p.productId,
        name:      p.product.name,
        views:     p.viewCount,
      })),

      // ── Leads by category (pie chart) ─────────────────────────────────────
      enquiriesByCategory: enquiriesByCategory.map((e) => ({
        category: e.category,
        count:    Number(e.count),
      })),

      // ── Buyer geography (treemap / heatmap) ───────────────────────────────
      buyerGeography: buyerCountries.map((b) => ({
        country: b.country,
        count:   Number(b.count),
      })),

      // ── Credit usage ──────────────────────────────────────────────────────
      creditUsage: {
        spent30d,
        purchased30d,
        currentBalance:  balance,
        dailyBurnRate:   Math.round(dailyBurnRate * 10) / 10,
        daysToDepletion,
        depletionDate,
        criticalAlert:   daysToDepletion !== null && daysToDepletion < 7,
      },
    };

    await this.redis.set(cacheKey, result, 3600); // 1-hour cache
    this.logger.log(`Analytics computed for seller ${seller.id} (period: ${period})`);
    return result;
  }

  // ─── Profile view helper ─────────────────────────────────────────────────────

  private async _getProfileViewCount(sellerId: string, days: number): Promise<number> {
    let total = 0;
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      total += await this.redis.pfCount(`seller:views:hll:${sellerId}:${d}`);
    }
    return total;
  }

  // ─── CSV export ─────────────────────────────────────────────────────────────

  async getExportCsv(userId: string, period: AnalyticsPeriod): Promise<string> {
    const data = await this.getAnalytics(userId, period);

    const lines: string[] = [];

    // Header
    lines.push(`B2B Marketplace — Seller Analytics Export`);
    lines.push(`Period: Last ${period.replace('d', ' days')} | Generated: ${new Date().toLocaleString('en-IN')}`);
    lines.push('');

    // KPIs
    lines.push('KPIs');
    lines.push(`Metric,Value`);
    lines.push(`Product Views (Total),${data.productViews.total}`);
    lines.push(`Leads Revealed (Period),${data.leadsViewed.total}`);
    lines.push(`Leads Converted (Period),${data.leadsViewed.converted}`);
    lines.push(`Conversion Rate,${data.leadsViewed.conversionRate}%`);
    lines.push(`Credit Balance,${data.creditUsage.currentBalance}`);
    lines.push(`Credits Spent (30d),${data.creditUsage.spent30d}`);
    lines.push('');

    // Daily engagement trend
    lines.push('Daily Engagement Trend');
    lines.push('Date,Leads Revealed');
    data.engagementTrend.forEach((r: { date: string; reveals: number }) => {
      lines.push(`${r.date},${r.reveals}`);
    });
    lines.push('');

    // Top products
    lines.push('Top Products by Views');
    lines.push('Product,Views');
    data.topProducts.forEach((p: { name: string; views: number }) => {
      lines.push(`"${p.name.replace(/"/g, '""')}",${p.views}`);
    });
    lines.push('');

    // Enquiries by category
    lines.push('Enquiries by Category');
    lines.push('Category,Count');
    data.enquiriesByCategory.forEach((e: { category: string; count: number }) => {
      lines.push(`"${e.category.replace(/"/g, '""')}",${e.count}`);
    });
    lines.push('');

    // Buyer geography
    lines.push('Buyer Geography');
    lines.push('Country,Enquiries');
    data.buyerGeography.forEach((b: { country: string; count: number }) => {
      lines.push(`"${b.country.replace(/"/g, '""')}",${b.count}`);
    });

    return lines.join('\n');
  }
}
