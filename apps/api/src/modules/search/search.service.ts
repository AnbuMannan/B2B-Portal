import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ElasticsearchService } from '../../services/elasticsearch/elasticsearch.service';
import { PrismaService } from '../../database/database.service';
import { RedisService } from '../../services/redis/redis.service';
import {
  SearchRequestDto,
  SearchFiltersDto,
  SearchSortBy,
  SearchResponseDto,
  SearchProductDto,
  AggregationsDto,
  AutocompleteResponseDto,
} from './dto/search.dto';

const INDEX_NAME = 'b2b_products';

// Hinglish synonym pairs for the index settings
const HINGLISH_SYNONYMS = [
  'dal, pulses, lentils',
  'kapda, fabric, textile, cloth',
  'dawa, medicine, pharmaceutical',
  'machine, machinery, equipment',
  'kaagaz, paper, stationery',
  'gehun, wheat, grain',
  'cheeni, sugar',
  'tel, oil, edible oil',
  'dudh, milk, dairy',
  'sabzi, vegetable, produce',
  'atta, flour, wheat flour',
  'chawal, rice, grain',
  'namak, salt',
  'masala, spice, seasoning',
  'kapas, cotton',
];

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly esService: ElasticsearchService,
    @InjectQueue('search-sync') private readonly searchSyncQueue: Queue,
    @InjectQueue('search-analytics') private readonly analyticsQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.ensureIndexExists().catch((err) => {
      this.logger.warn(`Index setup deferred (ES may not be ready): ${err.message}`);
    });
  }

  // ─── Index Management ────────────────────────────────────────────────────────

  async ensureIndexExists(): Promise<void> {
    const client = this.esService.getClient();
    const exists = await client.indices.exists({ index: INDEX_NAME });
    if (exists) {
      this.logger.log(`✅ Elasticsearch index '${INDEX_NAME}' already exists`);
      return;
    }

    await client.indices.create({
      index: INDEX_NAME,
      settings: {
        number_of_shards: 1,
        number_of_replicas: 1,
        analysis: {
          filter: {
            hinglish_synonyms: {
              type: 'synonym',
              synonyms: HINGLISH_SYNONYMS,
            },
          },
          analyzer: {
            hinglish_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'hinglish_synonyms'],
            },
          },
        },
      } as any,
      mappings: {
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'standard',
            fields: { keyword: { type: 'keyword' } },
          },
          name_hinglish: { type: 'text', analyzer: 'hinglish_analyzer' },
          name_suggest: { type: 'completion' },
          description: { type: 'text', analyzer: 'standard' },
          categoryNames: { type: 'keyword' },
          sellerCompanyName: {
            type: 'text',
            analyzer: 'standard',
            fields: { keyword: { type: 'keyword' } },
          },
          sellerCompanyName_suggest: { type: 'completion' },
          sellerState: { type: 'keyword' },
          sellerCity: { type: 'keyword' },
          sellerBadges: { type: 'keyword' },
          companyType: { type: 'keyword' },
          priceRetail: { type: 'float' },
          priceWholesale: { type: 'float' },
          priceBulk: { type: 'float' },
          moqRetail: { type: 'integer' },
          isVerified: { type: 'boolean' },
          hasIEC: { type: 'boolean' },
          hsnCode: { type: 'keyword' },
          countryOfOrigin: { type: 'keyword' },
          availabilityStatus: { type: 'keyword' },
          adminApprovalStatus: { type: 'keyword' },
          primaryImage: { type: 'keyword', index: false },
          createdAt: { type: 'date' },
        },
      } as any,
    });

    this.logger.log(`✅ Created Elasticsearch index '${INDEX_NAME}' with Hinglish synonym filter`);
  }

  // ─── Search ──────────────────────────────────────────────────────────────────

  async search(
    dto: SearchRequestDto,
    userId?: string,
    ipAddress?: string,
  ): Promise<SearchResponseDto> {
    let result: SearchResponseDto;

    try {
      result = await this.searchElasticsearch(dto);
    } catch (error) {
      this.logger.error(`Elasticsearch search failed — falling back to Prisma: ${error.message}`);
      result = await this.searchPrismaFallback(dto);
    }

    if (result.total === 0) {
      // Wrap so a Redis/DB error never breaks the search response
      result.trendingProducts = await this.getTrendingProducts(6).catch(() => []);
    }

    // Write SearchLog directly to DB (non-blocking) — works even without Redis/queue
    setImmediate(() => {
      (this.prisma as any).searchLog
        .create({
          data: {
            query: dto.q,
            resultsCount: result.total,
            filters: dto.filters ?? undefined,
            userId: userId ?? undefined,
            ipAddress: ipAddress ?? undefined,
          },
        })
        .catch((err: Error) =>
          this.logger.warn(`SearchLog write failed: ${err.message}`),
        );
    });

    // Also enqueue for any future analytics pipeline (best-effort, needs Redis)
    this.analyticsQueue
      .add('log-search', {
        query: dto.q,
        resultsCount: result.total,
        filters: dto.filters ?? null,
        userId: userId ?? null,
        ipAddress: ipAddress ?? null,
      })
      .catch(() => undefined); // silent — queue unavailable without Redis

    return result;
  }

  private async searchElasticsearch(dto: SearchRequestDto): Promise<SearchResponseDto> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const response = await this.esService.search({
      index: INDEX_NAME,
      from: (page - 1) * limit,
      size: limit,
      query: this.buildESQuery(dto.q, dto.filters),
      sort: this.buildSort(dto.filters?.sortBy),
      aggs: this.buildAggregations(),
      highlight: {
        pre_tags: ['<mark>'],
        post_tags: ['</mark>'],
        fields: {
          name: { number_of_fragments: 0 },
          description: { number_of_fragments: 1, fragment_size: 160 },
        },
      },
    });

    const total =
      typeof response.hits.total === 'object'
        ? response.hits.total.value
        : (response.hits.total ?? 0);

    return {
      products: response.hits.hits.map((hit: any) => this.transformESHit(hit)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      aggregations: this.transformAggregations(response.aggregations),
      trendingProducts: [],
    };
  }

  private buildESQuery(q: string, filters?: SearchFiltersDto): any {
    const must: any[] = [
      {
        multi_match: {
          query: q,
          fields: [
            'name^3',
            'name_hinglish^2.5',
            'description^2',
            'sellerCompanyName^1.5',
            'categoryNames^1',
          ],
          fuzziness: 'AUTO',
          operator: 'or',
          type: 'best_fields',
        },
      },
      { term: { adminApprovalStatus: 'APPROVED' } },
    ];

    const filter: any[] = [];

    if (filters?.priceMin !== undefined || filters?.priceMax !== undefined) {
      const range: Record<string, number> = {};
      if (filters.priceMin !== undefined) range.gte = filters.priceMin;
      if (filters.priceMax !== undefined) range.lte = filters.priceMax;
      filter.push({ range: { priceRetail: range } });
    }

    if (filters?.states?.length) {
      filter.push({ terms: { sellerState: filters.states } });
    }

    if (filters?.sellerTypes?.length) {
      filter.push({ terms: { companyType: filters.sellerTypes } });
    }

    if (filters?.verifiedOnly === true) {
      filter.push({ term: { isVerified: true } });
    }

    if (filters?.iecGlobal === true) {
      filter.push({ term: { hasIEC: true } });
    }

    if (filters?.hsnCode) {
      filter.push({ term: { hsnCode: filters.hsnCode } });
    }

    if (filters?.categoryIds?.length) {
      filter.push({ terms: { categoryNames: filters.categoryIds } });
    }

    return { bool: { must, filter } };
  }

  private buildSort(sortBy?: SearchSortBy): any[] {
    switch (sortBy) {
      case SearchSortBy.PRICE_ASC:
        return [{ priceRetail: { order: 'asc' } }];
      case SearchSortBy.PRICE_DESC:
        return [{ priceRetail: { order: 'desc' } }];
      case SearchSortBy.NEWEST:
        return [{ createdAt: { order: 'desc' } }];
      default:
        return [{ _score: { order: 'desc' } }, { createdAt: { order: 'desc' } }];
    }
  }

  private buildAggregations(): any {
    return {
      states: { terms: { field: 'sellerState', size: 10 } },
      companyTypes: { terms: { field: 'companyType', size: 10 } },
      priceRanges: {
        range: {
          field: 'priceRetail',
          ranges: [
            { key: '0-1000', to: 1000 },
            { key: '1000-5000', from: 1000, to: 5000 },
            { key: '5000-25000', from: 5000, to: 25000 },
            { key: '25000+', from: 25000 },
          ],
        },
      },
      categories: { terms: { field: 'categoryNames', size: 10 } },
    };
  }

  private transformAggregations(aggs: any): AggregationsDto {
    if (!aggs) {
      return { states: [], companyTypes: [], priceRanges: [], categories: [] };
    }

    return {
      states: (aggs.states?.buckets ?? []).map((b: any) => ({
        key: b.key,
        docCount: b.doc_count,
      })),
      companyTypes: (aggs.companyTypes?.buckets ?? []).map((b: any) => ({
        key: b.key,
        docCount: b.doc_count,
      })),
      priceRanges: (aggs.priceRanges?.buckets ?? []).map((b: any) => ({
        key: b.key,
        from: b.from,
        to: b.to,
        docCount: b.doc_count,
      })),
      categories: (aggs.categories?.buckets ?? []).map((b: any) => ({
        key: b.key,
        docCount: b.doc_count,
      })),
    };
  }

  private transformESHit(hit: any): SearchProductDto {
    const src = hit._source ?? {};
    return {
      id: hit._id ?? src.id,
      name: src.name,
      description: src.description,
      primaryImage: src.primaryImage,
      sellerCompanyName: src.sellerCompanyName,
      sellerState: src.sellerState,
      sellerCity: src.sellerCity,
      companyType: src.companyType,
      isVerified: src.isVerified ?? false,
      hasIEC: src.hasIEC ?? false,
      priceRetail: src.priceRetail,
      priceWholesale: src.priceWholesale,
      priceBulk: src.priceBulk,
      moqRetail: src.moqRetail,
      verificationBadges: src.sellerBadges ?? [],
      categoryNames: src.categoryNames ?? [],
      hsnCode: src.hsnCode,
      availabilityStatus: src.availabilityStatus,
      createdAt: src.createdAt,
      highlight: hit.highlight
        ? {
            name: hit.highlight.name,
            description: hit.highlight.description,
          }
        : undefined,
    };
  }

  // ─── Prisma fallback ─────────────────────────────────────────────────────────

  private async searchPrismaFallback(dto: SearchRequestDto): Promise<SearchResponseDto> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    // Build AND array so all conditions (text search + filters) combine correctly
    const andConditions: any[] = [
      {
        OR: [
          { name: { contains: dto.q, mode: 'insensitive' } },
          { description: { contains: dto.q, mode: 'insensitive' } },
        ],
      },
    ];

    const where: any = {
      AND: andConditions,
      isActive: true,
      adminApprovalStatus: 'APPROVED',
    };

    // Price filter on multiTierPricing JSON: product matches if ANY tier falls within range
    if (dto.filters?.priceMin !== undefined || dto.filters?.priceMax !== undefined) {
      const tiers = ['RETAIL', 'WHOLESALE', 'BULK'];
      const tierConditions = tiers.map((tier) => {
        const tierAnd: any[] = [];
        if (dto.filters?.priceMin !== undefined) {
          tierAnd.push({
            multiTierPricing: { path: [tier, 'price'], gte: dto.filters.priceMin },
          });
        }
        if (dto.filters?.priceMax !== undefined) {
          tierAnd.push({
            multiTierPricing: { path: [tier, 'price'], lte: dto.filters.priceMax },
          });
        }
        return tierAnd.length === 2 ? { AND: tierAnd } : tierAnd[0];
      });
      // Add price conditions alongside (not instead of) the text search
      andConditions.push({ OR: tierConditions });
    }

    // Seller relation filters (state, type, verification)
    const sellerFilter: Record<string, any> = {};
    if (dto.filters?.states?.length) {
      sellerFilter.state = { in: dto.filters.states };
    }
    if (dto.filters?.sellerTypes?.length) {
      sellerFilter.companyType = { in: dto.filters.sellerTypes as any };
    }
    if (dto.filters?.verifiedOnly) {
      sellerFilter.isVerified = true;
    }
    if (dto.filters?.iecGlobal) {
      sellerFilter.iecCode = { not: null };
    }
    if (Object.keys(sellerFilter).length) {
      where.seller = sellerFilter;
    }

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          seller: {
            select: {
              companyName: true,
              companyType: true,
              isVerified: true,
              iecCode: true,
              state: true,
              city: true,
            },
          },
          categories: { include: { category: { select: { name: true } } } },
        },
      }),
    ]);

    return {
      products: products.map((p: any) => this.transformPrismaProduct(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      aggregations: { states: [], companyTypes: [], priceRanges: [], categories: [] },
      trendingProducts: [],
    };
  }

  private transformPrismaProduct(product: any): SearchProductDto {
    const pricing = product.multiTierPricing as any;
    const retail =
      pricing?.RETAIL ?? pricing?.retail ?? pricing?.tier1 ?? {};
    const wholesale =
      pricing?.WHOLESALE ?? pricing?.wholesale ?? pricing?.tier2 ?? {};
    const bulk = pricing?.BULK ?? pricing?.bulk ?? pricing?.tier3 ?? {};

    const seller = product.seller ?? {};
    const badges: string[] = [];
    if (seller.isVerified) badges.push('Verified Seller');
    if (seller.gstNumber) badges.push('GST Verified');
    if (seller.iecCode) badges.push('IEC Global');

    const images = Array.isArray(product.images) ? product.images : [];

    return {
      id: product.id,
      name: product.name,
      description: product.description ?? undefined,
      primaryImage: images[0] ?? undefined,
      sellerCompanyName: seller.companyName ?? '',
      sellerState: seller.state ?? undefined,
      sellerCity: seller.city ?? undefined,
      companyType: seller.companyType ?? undefined,
      isVerified: seller.isVerified ?? false,
      hasIEC: !!seller.iecCode,
      priceRetail: retail.price ?? undefined,
      priceWholesale: wholesale.price ?? undefined,
      priceBulk: bulk.price ?? undefined,
      moqRetail: retail.moq ?? undefined,
      verificationBadges: badges,
      categoryNames: (product.categories ?? []).map((pc: any) => pc.category?.name ?? ''),
      hsnCode: product.hsnCode ?? undefined,
      availabilityStatus: product.availabilityStatus ?? undefined,
      createdAt: product.createdAt?.toISOString?.() ?? product.createdAt,
    };
  }

  // ─── Autocomplete ─────────────────────────────────────────────────────────────

  async autocomplete(q: string): Promise<AutocompleteResponseDto> {
    if (!q || q.trim().length < 2) {
      return { products: [], sellers: [] };
    }

    const normalised = q.trim().toLowerCase();
    const cacheKey = `autocomplete:${normalised}`;

    // Redis cache (best-effort — Redis may not be running)
    const cached = await this.redis.get<AutocompleteResponseDto>(cacheKey).catch(() => null);
    if (cached) return cached;

    // Try Elasticsearch completion suggester first
    try {
      const response = await this.esService.getClient().search({
        index: INDEX_NAME,
        suggest: {
          product_suggest: {
            prefix: normalised,
            completion: { field: 'name_suggest', size: 5, skip_duplicates: true },
          },
          seller_suggest: {
            prefix: normalised,
            completion: { field: 'sellerCompanyName_suggest', size: 3, skip_duplicates: true },
          },
        },
        _source: false,
        size: 0,
      } as any);

      const productSuggestions = (
        (response as any).suggest?.product_suggest?.[0]?.options ?? []
      )
        .slice(0, 5)
        .map((opt: any) => ({ text: opt.text, type: 'product' as const }));

      const sellerSuggestions = (
        (response as any).suggest?.seller_suggest?.[0]?.options ?? []
      )
        .slice(0, 3)
        .map((opt: any) => ({ text: opt.text, type: 'seller' as const }));

      const result: AutocompleteResponseDto = { products: productSuggestions, sellers: sellerSuggestions };

      // Cache result (best-effort)
      this.redis.set(cacheKey, result, 600).catch(() => undefined);
      return result;
    } catch {
      // ES not available — fall back to Prisma prefix search
      return this.autocompletePrismaFallback(normalised);
    }
  }

  private async autocompletePrismaFallback(q: string): Promise<AutocompleteResponseDto> {
    const [products, sellers] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          name: { contains: q, mode: 'insensitive' },
          adminApprovalStatus: 'APPROVED' as any,
          isActive: true,
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { name: true },
      }),
      this.prisma.seller.findMany({
        where: { companyName: { contains: q, mode: 'insensitive' } },
        take: 3,
        select: { companyName: true },
      }),
    ]);

    return {
      products: products.map((p: any) => ({ text: p.name, type: 'product' as const })),
      sellers: sellers.map((s: any) => ({ text: s.companyName, type: 'seller' as const })),
    };
  }

  // ─── Document Indexing ────────────────────────────────────────────────────────

  async indexProduct(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        seller: {
          select: {
            companyName: true,
            companyType: true,
            isVerified: true,
            iecCode: true,
            gstNumber: true,
            state: true,
            city: true,
          },
        },
        categories: {
          include: { category: { select: { name: true } } },
        },
      },
    });

    if (!product) {
      this.logger.warn(`indexProduct: product ${productId} not found`);
      return;
    }

    const doc = this.buildESDocument(product);

    await this.esService.getClient().index({
      index: INDEX_NAME,
      id: productId,
      document: doc,
    });

    this.logger.log(`Indexed product ${productId} into '${INDEX_NAME}'`);
  }

  async deleteProductFromIndex(productId: string): Promise<void> {
    try {
      await this.esService.getClient().delete({ index: INDEX_NAME, id: productId });
      this.logger.log(`Deleted product ${productId} from '${INDEX_NAME}'`);
    } catch (error) {
      // 404 means it was never indexed — not an error worth throwing
      if (error?.meta?.statusCode !== 404) {
        throw error;
      }
    }
  }

  private buildESDocument(product: any): Record<string, any> {
    const seller = product.seller ?? {};
    const pricing = product.multiTierPricing as any ?? {};
    const images = Array.isArray(product.images) ? product.images : [];

    const retail = pricing.RETAIL ?? pricing.retail ?? pricing.tier1 ?? {};
    const wholesale = pricing.WHOLESALE ?? pricing.wholesale ?? pricing.tier2 ?? {};
    const bulk = pricing.BULK ?? pricing.bulk ?? pricing.tier3 ?? {};

    const categoryNames: string[] = (product.categories ?? []).map(
      (pc: any) => pc.category?.name ?? '',
    );

    const badges: string[] = [];
    if (seller.isVerified) badges.push('Verified Seller');
    if (seller.gstNumber) badges.push('GST Verified');
    if (seller.iecCode) badges.push('IEC Global');

    // Normalise product name for Hinglish suggest input
    const suggestInputs = [
      product.name,
      ...product.name.toLowerCase().split(' ').filter((w: string) => w.length > 2),
    ].filter(Boolean);

    return {
      id: product.id,
      name: product.name,
      name_hinglish: product.name,
      name_suggest: { input: suggestInputs, weight: seller.isVerified ? 10 : 1 },
      description: product.description ?? '',
      categoryNames,
      sellerCompanyName: seller.companyName ?? '',
      sellerCompanyName_suggest: {
        input: [seller.companyName],
        weight: seller.isVerified ? 10 : 1,
      },
      sellerState: seller.state ?? null,
      sellerCity: seller.city ?? null,
      sellerBadges: badges,
      companyType: seller.companyType ?? null,
      priceRetail: retail.price ?? 0,
      priceWholesale: wholesale.price ?? 0,
      priceBulk: bulk.price ?? 0,
      moqRetail: retail.moq ?? 1,
      isVerified: seller.isVerified ?? false,
      hasIEC: !!seller.iecCode,
      hsnCode: product.hsnCode ?? null,
      countryOfOrigin: product.countryOfOrigin ?? null,
      availabilityStatus: product.availabilityStatus ?? null,
      adminApprovalStatus: product.adminApprovalStatus ?? 'PENDING',
      primaryImage: images[0] ?? null,
      createdAt: product.createdAt ?? new Date(),
    };
  }

  // ─── Trending Products ────────────────────────────────────────────────────────

  async getTrendingProducts(limit = 6): Promise<SearchProductDto[]> {
    const cacheKey = `trending:products:${limit}`;
    // Redis is optional — if not running, skip cache and hit DB directly
    const cached = await this.redis.get<SearchProductDto[]>(cacheKey).catch(() => null);
    if (cached) return cached;

    // Fetch most-viewed products
    const topViewed = await this.prisma.productViewTracking.findMany({
      orderBy: { viewCount: 'desc' },
      take: limit,
      select: { productId: true },
    });

    const productIds = topViewed.map((v: any) => v.productId);

    // If no view tracking, fall back to newest approved products
    const where: any =
      productIds.length > 0
        ? { id: { in: productIds }, isActive: true, adminApprovalStatus: 'APPROVED' }
        : { isActive: true, adminApprovalStatus: 'APPROVED' };

    const products = await this.prisma.product.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        seller: {
          select: {
            companyName: true,
            companyType: true,
            isVerified: true,
            iecCode: true,
            gstNumber: true,
            state: true,
            city: true,
          },
        },
        categories: { include: { category: { select: { name: true } } } },
      },
    });

    const result = products.map((p: any) => this.transformPrismaProduct(p));
    this.redis.set(cacheKey, result, 300).catch(() => undefined); // best-effort cache
    return result;
  }
}
