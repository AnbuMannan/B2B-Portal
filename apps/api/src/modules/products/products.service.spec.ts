import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../../database/database.service';
import { RedisService } from '../../services/redis/redis.service';
import { CategoryProductsQueryDto, ProductsQueryDto, ProductSortBy } from './dto/products.dto';
import { PaginationParamsDto } from '../../common/dto/pagination.dto';
import { ElasticsearchService } from '../../services/elasticsearch/elasticsearch.service';
import { CacheInvalidationService } from '../../common/services/cache-invalidation.service';
import { getQueueToken } from '@nestjs/bull';

const mockPrismaService = {
  category: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  product: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  productViewTracking: {
    upsert: jest.fn(),
  },
};

const mockRedisService = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockElasticsearchService = {
  search: jest.fn(),
};

const mockCacheInvalidationService = {
  invalidateProductCaches: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
};

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: PrismaService;
  let redis: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: ElasticsearchService,
          useValue: mockElasticsearchService,
        },
        {
          provide: CacheInvalidationService,
          useValue: mockCacheInvalidationService,
        },
        {
          provide: getQueueToken('search-sync'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
    jest.clearAllMocks();
  });

  describe('getCategoryProducts', () => {
    it('should return paginated products for a valid category', async () => {
      const category = { id: 'cat1', name: 'Electronics' };
      const query: CategoryProductsQueryDto = { page: 1, limit: 20, sortBy: ProductSortBy.RELEVANCE };

      mockPrismaService.category.findUnique.mockResolvedValue(category);
      mockPrismaService.product.count.mockResolvedValue(5);
      mockPrismaService.product.findMany.mockResolvedValue([
        {
          id: 'prod1',
          name: 'Test Product',
          seller: {
            companyName: 'Test Seller',
            companyType: 'Manufacturer',
            isVerified: true,
            gstNumber: '123',
            iecCode: '456',
          },
          categories: [{ category: { name: 'Electronics' } }],
          multiTierPricing: { retail: { price: 1000, moq: 10 } },
          availabilityStatus: 'IN_STOCK',
          createdAt: new Date('2024-01-01'),
        },
      ]);

      const result = await service.getCategoryProducts('cat1', query);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.offset).toBe(0);
      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: 'cat1' },
      });
    });

    it('should throw NotFoundException for invalid category', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      const query: CategoryProductsQueryDto = { page: 1, limit: 20, sortBy: ProductSortBy.RELEVANCE };

      await expect(
        service.getCategoryProducts('invalid', query)
      ).rejects.toThrow(NotFoundException);
    });

    it('should filter by price range', async () => {
      const category = { id: 'cat1', name: 'Electronics' };
      const query: CategoryProductsQueryDto = {
        page: 1, limit: 20,
        sortBy: ProductSortBy.RELEVANCE,
        priceMin: 1000, priceMax: 5000,
      };

      mockPrismaService.category.findUnique.mockResolvedValue(category);
      mockPrismaService.product.count.mockResolvedValue(2);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      await service.getCategoryProducts('cat1', query);

      const whereClause = mockPrismaService.product.findMany.mock.calls[0][0].where;
      expect(whereClause.AND).toBeDefined();
    });

    it('should sort by price ascending', async () => {
      const category = { id: 'cat1', name: 'Electronics' };
      const query: CategoryProductsQueryDto = { page: 1, limit: 20, sortBy: ProductSortBy.PRICE_ASC };

      mockPrismaService.category.findUnique.mockResolvedValue(category);
      mockPrismaService.product.count.mockResolvedValue(5);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      await service.getCategoryProducts('cat1', query);

      const orderByClause = mockPrismaService.product.findMany.mock.calls[0][0].orderBy;
      expect(orderByClause).toEqual({
        multiTierPricing: { sort: 'asc', path: '$.retail.price' },
      });
    });

    it('should sort by price descending', async () => {
      const category = { id: 'cat1', name: 'Electronics' };
      const query: CategoryProductsQueryDto = { page: 1, limit: 20, sortBy: ProductSortBy.PRICE_DESC };

      mockPrismaService.category.findUnique.mockResolvedValue(category);
      mockPrismaService.product.count.mockResolvedValue(5);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      await service.getCategoryProducts('cat1', query);

      const orderByClause = mockPrismaService.product.findMany.mock.calls[0][0].orderBy;
      expect(orderByClause).toEqual({
        multiTierPricing: { sort: 'desc', path: '$.retail.price' },
      });
    });

    it('should sort by newest', async () => {
      const category = { id: 'cat1', name: 'Electronics' };
      const query: CategoryProductsQueryDto = { page: 1, limit: 20, sortBy: ProductSortBy.NEWEST };

      mockPrismaService.category.findUnique.mockResolvedValue(category);
      mockPrismaService.product.count.mockResolvedValue(5);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      await service.getCategoryProducts('cat1', query);

      const orderByClause = mockPrismaService.product.findMany.mock.calls[0][0].orderBy;
      expect(orderByClause).toEqual({ createdAt: 'desc' });
    });
  });

  describe('getCategoriesWithProductCounts', () => {
    it('should return categories from cache if available', async () => {
      const cachedData = [
        {
          id: 'cat1',
          name: 'Electronics',
          productCount: 10,
          children: [],
        },
      ];

      mockRedisService.get.mockResolvedValue(cachedData);

      const result = await service.getCategoriesWithProductCounts();

      expect(result).toEqual(cachedData);
      expect(redis.get).toHaveBeenCalledWith('categories:with-product-counts');
      expect(prisma.category.findMany).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not in cache', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.category.findMany.mockResolvedValue([
        {
          id: 'cat1',
          name: 'Electronics',
          productLinks: [{ productId: 'prod1' }, { productId: 'prod2' }],
          children: [
            {
              id: 'cat2',
              name: 'Mobile Phones',
              productLinks: [{ productId: 'prod3' }],
            },
          ],
        },
      ]);

      const result = await service.getCategoriesWithProductCounts();

      expect(result).toEqual([
        {
          id: 'cat1',
          name: 'Electronics',
          productCount: 2,
          children: [
            {
              id: 'cat2',
              name: 'Mobile Phones',
              productCount: 1,
            },
          ],
        },
      ]);
      expect(redis.set).toHaveBeenCalledWith(
        'categories:with-product-counts',
        expect.any(Object),
        24 * 60 * 60
      );
    });
  });

  describe('getProductDetail', () => {
    it('should return product details with related products', async () => {
      const product = {
        id: 'prod1',
        name: 'Test Product',
        seller: {
          id: 'seller1',
          companyName: 'Test Seller',
          companyType: 'Manufacturer',
          isVerified: true,
          gstNumber: '123',
          iecCode: '456',
        },
        categories: [
          { categoryId: 'cat1', category: { name: 'Electronics' } },
          { categoryId: 'cat2', category: { name: 'Mobile Phones' } },
        ],
        productViewTracking: [{ viewCount: 100 }],
        multiTierPricing: { retail: { price: 1000, moq: 10 } },
        availabilityStatus: 'IN_STOCK',
        createdAt: new Date('2024-01-01'),
      };

      mockPrismaService.product.findUnique.mockResolvedValue(product);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.getProductDetail('prod1');

      expect(result.id).toBe('prod1');
      expect(result.sellerCompanyName).toBe('Test Seller');
      expect(result.verificationBadges).toContain('GST Verified');
      expect(result.verificationBadges).toContain('IEC Global');
      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException for invalid product', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.getProductDetail('invalid')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('searchProducts', () => {
    it('should search products with fallback to database', async () => {
      const paginationParams: PaginationParamsDto = { page: 1, limit: 20 };
      const productsQuery: ProductsQueryDto = { sortBy: ProductSortBy.RELEVANCE };

      mockPrismaService.product.count.mockResolvedValue(5);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.searchProducts(
        paginationParams,
        productsQuery,
        'test'
      );

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(5);
    });
  });

  describe('pagination calculation', () => {
    it('should calculate correct offset for page 2 with limit 20', async () => {
      const category = { id: 'cat1', name: 'Electronics' };
      const query: CategoryProductsQueryDto = { page: 2, limit: 20, sortBy: ProductSortBy.RELEVANCE };

      mockPrismaService.category.findUnique.mockResolvedValue(category);
      mockPrismaService.product.count.mockResolvedValue(50);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.getCategoryProducts('cat1', query);

      expect(result.pagination.offset).toBe(20); // (2-1) * 20 = 20
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.pages).toBe(3); // 50 / 20 = 2.5 → ceil to 3
    });
  });
});
