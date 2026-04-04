import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { SearchService } from './search.service';
import { ElasticsearchService } from '../../services/elasticsearch/elasticsearch.service';
import { PrismaService } from '../../database/database.service';
import { RedisService } from '../../services/redis/redis.service';
import { SearchRequestDto, SearchSortBy } from './dto/search.dto';

// ─── Mock factories ───────────────────────────────────────────────────────────

const makeESHit = (overrides: Record<string, any> = {}) => ({
  _id: 'prod-1',
  _source: {
    id: 'prod-1',
    name: 'Cotton Fabric Premium',
    description: 'High quality cotton fabric for garments',
    sellerCompanyName: 'ABC Textiles',
    sellerState: 'TN',
    companyType: 'MANUFACTURER',
    isVerified: true,
    hasIEC: false,
    priceRetail: 500,
    priceWholesale: 450,
    priceBulk: 400,
    moqRetail: 10,
    categoryNames: ['Fabric', 'Textile'],
    adminApprovalStatus: 'APPROVED',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  },
  highlight: { name: ['<mark>Cotton</mark> Fabric Premium'] },
});

const makeESResponse = (hits: any[] = [makeESHit()], total = 1, aggs: any = {}) => ({
  hits: {
    total: { value: total, relation: 'eq' },
    hits,
  },
  aggregations: {
    states: { buckets: [{ key: 'TN', doc_count: 5 }] },
    companyTypes: { buckets: [{ key: 'MANUFACTURER', doc_count: 3 }] },
    priceRanges: {
      buckets: [
        { key: '0-1000', from: 0, to: 1000, doc_count: 8 },
        { key: '1000-5000', from: 1000, to: 5000, doc_count: 4 },
      ],
    },
    categories: { buckets: [{ key: 'Fabric', doc_count: 5 }] },
    ...aggs,
  },
});

const makePrismaProduct = (overrides: Record<string, any> = {}) => ({
  id: 'prod-prisma-1',
  name: 'Cotton Fabric Basic',
  description: 'Basic cotton fabric',
  hsnCode: '5208',
  multiTierPricing: { RETAIL: { price: 300, moq: 1 }, WHOLESALE: { price: 250, moq: 50 } },
  images: ['https://example.com/img.jpg'],
  availabilityStatus: 'IN_STOCK',
  adminApprovalStatus: 'APPROVED',
  countryOfOrigin: 'India',
  createdAt: new Date('2024-01-01'),
  seller: {
    companyName: 'XYZ Textiles',
    companyType: 'WHOLESALER',
    isVerified: true,
    iecCode: 'IEC123',
    gstNumber: 'GST123',
    state: 'MH',
    city: 'Mumbai',
  },
  categories: [{ category: { name: 'Fabric' } }],
  ...overrides,
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockEsClient = {
  indices: {
    exists: jest.fn().mockResolvedValue(true),
    create: jest.fn().mockResolvedValue({}),
  },
  index: jest.fn().mockResolvedValue({ result: 'created' }),
  delete: jest.fn().mockResolvedValue({ result: 'deleted' }),
  search: jest.fn().mockResolvedValue({ suggest: {} }),
};

const mockEsService = {
  search: jest.fn(),
  getClient: jest.fn().mockReturnValue(mockEsClient),
};

const mockPrisma = {
  product: {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
  productViewTracking: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
};

const mockSearchSyncQueue = {
  add: jest.fn().mockResolvedValue({}),
};

const mockAnalyticsQueue = {
  add: jest.fn().mockResolvedValue({}),
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default: ES returns results
    mockEsService.search.mockResolvedValue(makeESResponse());
    mockPrisma.product.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: ElasticsearchService, useValue: mockEsService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: getQueueToken('search-sync'), useValue: mockSearchSyncQueue },
        { provide: getQueueToken('search-analytics'), useValue: mockAnalyticsQueue },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  // ── Test 1: Search for "cotton fabric" returns textile products ────────────

  describe('search("cotton fabric")', () => {
    it('returns textile products from Elasticsearch', async () => {
      const dto: SearchRequestDto = { q: 'cotton fabric', page: 1, limit: 20 };

      const result = await service.search(dto);

      expect(mockEsService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'b2b_products',
          query: expect.objectContaining({
            bool: expect.objectContaining({
              must: expect.arrayContaining([
                expect.objectContaining({
                  multi_match: expect.objectContaining({ query: 'cotton fabric' }),
                }),
              ]),
            }),
          }),
        }),
      );

      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toBe('Cotton Fabric Premium');
      expect(result.total).toBe(1);
    });

    it('enqueues search analytics job after search', async () => {
      const dto: SearchRequestDto = { q: 'cotton fabric', page: 1, limit: 20 };
      await service.search(dto, 'user-123', '127.0.0.1');

      // Allow microtask queue to drain (analytics is fire-and-forget)
      await new Promise((r) => setImmediate(r));

      expect(mockAnalyticsQueue.add).toHaveBeenCalledWith(
        'log-search',
        expect.objectContaining({
          query: 'cotton fabric',
          resultsCount: 1,
          userId: 'user-123',
          ipAddress: '127.0.0.1',
        }),
      );
    });
  });

  // ── Test 2: Price filter builds correct ES range clause ────────────────────

  describe('price filter (priceMin=1000, priceMax=5000)', () => {
    it('adds range filter on priceRetail to ES query', async () => {
      const dto: SearchRequestDto = {
        q: 'fabric',
        filters: { priceMin: 1000, priceMax: 5000 },
      };

      await service.search(dto);

      expect(mockEsService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              filter: expect.arrayContaining([
                { range: { priceRetail: { gte: 1000, lte: 5000 } } },
              ]),
            }),
          }),
        }),
      );
    });

    it('only adds gte when priceMin provided without priceMax', async () => {
      const dto: SearchRequestDto = {
        q: 'fabric',
        filters: { priceMin: 1000 },
      };

      await service.search(dto);

      expect(mockEsService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              filter: expect.arrayContaining([
                { range: { priceRetail: { gte: 1000 } } },
              ]),
            }),
          }),
        }),
      );
    });
  });

  // ── Test 3: verifiedOnly=true adds isVerified term filter ─────────────────

  describe('verifiedOnly filter', () => {
    it('adds term filter { isVerified: true } when verifiedOnly=true', async () => {
      const dto: SearchRequestDto = {
        q: 'fabric',
        filters: { verifiedOnly: true },
      };

      await service.search(dto);

      expect(mockEsService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              filter: expect.arrayContaining([
                { term: { isVerified: true } },
              ]),
            }),
          }),
        }),
      );
    });

    it('does NOT add isVerified filter when verifiedOnly is false', async () => {
      const dto: SearchRequestDto = {
        q: 'fabric',
        filters: { verifiedOnly: false },
      };

      await service.search(dto);

      const call = mockEsService.search.mock.calls[0][0];
      const filterClauses = call.query.bool.filter as any[];
      expect(filterClauses.some((f: any) => f?.term?.isVerified !== undefined)).toBe(false);
    });
  });

  // ── Test 4: Autocomplete returns ≤5 suggestions within 100ms ──────────────

  describe('autocomplete()', () => {
    beforeEach(() => {
      mockEsClient.search.mockResolvedValue({
        suggest: {
          product_suggest: [
            {
              options: [
                { text: 'Cotton Fabric' },
                { text: 'Cotton Yarn' },
                { text: 'Cotton Bales' },
                { text: 'Cotton Seed Oil' },
                { text: 'Cotton Thread' },
                { text: 'Cotton Padding' }, // 6th — should be sliced to 5
              ],
            },
          ],
          seller_suggest: [
            {
              options: [
                { text: 'Cotton Corp India' },
                { text: 'Coimbatore Textiles' },
                { text: 'CottonMart' },
                { text: 'Cotton Palace' }, // 4th — should be sliced to 3
              ],
            },
          ],
        },
      });
    });

    it('returns at most 5 product suggestions', async () => {
      const result = await service.autocomplete('cotton');
      expect(result.products.length).toBeLessThanOrEqual(5);
    });

    it('returns at most 3 seller suggestions', async () => {
      const result = await service.autocomplete('cotton');
      expect(result.sellers.length).toBeLessThanOrEqual(3);
    });

    it('responds within 100ms (mocked ES)', async () => {
      const start = Date.now();
      await service.autocomplete('cotton');
      expect(Date.now() - start).toBeLessThan(100);
    });

    it('returns empty lists for queries shorter than 2 chars', async () => {
      const result = await service.autocomplete('c');
      expect(result.products).toHaveLength(0);
      expect(result.sellers).toHaveLength(0);
    });

    it('returns cached result on second call', async () => {
      mockRedis.get.mockResolvedValueOnce({ products: [{ text: 'Cached Result', type: 'product' }], sellers: [] });
      const result = await service.autocomplete('cotton');
      expect(result.products[0].text).toBe('Cached Result');
      expect(mockEsClient.search).not.toHaveBeenCalled();
    });
  });

  // ── Test 5: Fallback to Prisma when ES throws connection error ─────────────

  describe('Prisma fallback', () => {
    it('falls back to Prisma ILIKE search when Elasticsearch throws', async () => {
      mockEsService.search.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      mockPrisma.product.count.mockResolvedValueOnce(2);
      mockPrisma.product.findMany.mockResolvedValueOnce([
        makePrismaProduct(),
        makePrismaProduct({ id: 'prod-prisma-2', name: 'Cotton Fabric Deluxe' }),
      ]);

      const dto: SearchRequestDto = { q: 'cotton fabric', page: 1, limit: 20 };
      const result = await service.search(dto);

      expect(result.products).toHaveLength(2);
      expect(result.products[0].name).toBe('Cotton Fabric Basic');
      expect(result.total).toBe(2);
    });

    it('Prisma fallback applies state filter', async () => {
      mockEsService.search.mockRejectedValueOnce(new Error('timeout'));
      mockPrisma.product.count.mockResolvedValueOnce(0);
      mockPrisma.product.findMany.mockResolvedValueOnce([]);

      const dto: SearchRequestDto = {
        q: 'fabric',
        filters: { states: ['MH', 'TN'] },
      };

      await service.search(dto);

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            seller: expect.objectContaining({ state: { in: ['MH', 'TN'] } }),
          }),
        }),
      );
    });
  });

  // ── Test 6: SearchLog entry created via queue for each search ─────────────

  describe('search analytics logging', () => {
    it('enqueues a log-search job with correct payload', async () => {
      const dto: SearchRequestDto = {
        q: 'pulses',
        page: 1,
        filters: { priceMin: 100, verifiedOnly: true },
      };

      await service.search(dto, 'user-abc', '10.0.0.1');
      await new Promise((r) => setImmediate(r)); // drain microtasks

      expect(mockAnalyticsQueue.add).toHaveBeenCalledTimes(1);
      expect(mockAnalyticsQueue.add).toHaveBeenCalledWith(
        'log-search',
        expect.objectContaining({
          query: 'pulses',
          resultsCount: expect.any(Number),
          userId: 'user-abc',
          ipAddress: '10.0.0.1',
        }),
      );
    });

    it('still enqueues analytics even when ES returns zero results', async () => {
      mockEsService.search.mockResolvedValueOnce(makeESResponse([], 0));

      const dto: SearchRequestDto = { q: 'nonexistent-product-xyz' };
      await service.search(dto);
      await new Promise((r) => setImmediate(r));

      expect(mockAnalyticsQueue.add).toHaveBeenCalledWith(
        'log-search',
        expect.objectContaining({ query: 'nonexistent-product-xyz', resultsCount: 0 }),
      );
    });
  });

  // ── Test 7: Zero results returns trending products ─────────────────────────

  describe('zero results → trending products', () => {
    it('populates trendingProducts when ES returns 0 hits', async () => {
      mockEsService.search.mockResolvedValueOnce(makeESResponse([], 0));

      // Trending: view tracking has one product
      mockPrisma.productViewTracking.findMany.mockResolvedValueOnce([
        { productId: 'trending-1' },
      ]);
      mockPrisma.product.findMany.mockResolvedValueOnce([
        makePrismaProduct({ id: 'trending-1', name: 'Trending Product A' }),
      ]);

      const dto: SearchRequestDto = { q: 'qwerty-xyz-no-match' };
      const result = await service.search(dto);

      expect(result.total).toBe(0);
      expect(result.products).toHaveLength(0);
      expect(result.trendingProducts.length).toBeGreaterThan(0);
      expect(result.trendingProducts[0].name).toBe('Trending Product A');
    });

    it('does NOT call getTrendingProducts when results > 0', async () => {
      mockEsService.search.mockResolvedValueOnce(makeESResponse([makeESHit()], 1));

      const dto: SearchRequestDto = { q: 'cotton fabric' };
      const result = await service.search(dto);

      expect(result.trendingProducts).toHaveLength(0);
      expect(mockPrisma.productViewTracking.findMany).not.toHaveBeenCalled();
    });
  });

  // ── Additional: Sort options build correct ES sort clause ─────────────────

  describe('sort options', () => {
    it('PRICE_ASC generates { priceRetail: asc } sort', async () => {
      const dto: SearchRequestDto = {
        q: 'fabric',
        filters: { sortBy: SearchSortBy.PRICE_ASC },
      };

      await service.search(dto);

      expect(mockEsService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: [{ priceRetail: { order: 'asc' } }],
        }),
      );
    });

    it('NEWEST generates { createdAt: desc } sort', async () => {
      const dto: SearchRequestDto = {
        q: 'fabric',
        filters: { sortBy: SearchSortBy.NEWEST },
      };

      await service.search(dto);

      expect(mockEsService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: [{ createdAt: { order: 'desc' } }],
        }),
      );
    });
  });

  // ── Additional: indexProduct upserts document to ES ───────────────────────

  describe('indexProduct()', () => {
    it('fetches product from DB and calls client.index()', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(makePrismaProduct());

      await service.indexProduct('prod-prisma-1');

      expect(mockPrisma.product.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'prod-prisma-1' } }),
      );

      expect(mockEsClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'b2b_products',
          id: 'prod-prisma-1',
          document: expect.objectContaining({
            name: 'Cotton Fabric Basic',
            isVerified: true,
            hasIEC: true,
          }),
        }),
      );
    });

    it('does nothing when product not found in DB', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      await service.indexProduct('does-not-exist');
      expect(mockEsClient.index).not.toHaveBeenCalled();
    });
  });
});
