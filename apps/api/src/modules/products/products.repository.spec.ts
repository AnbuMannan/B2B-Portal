import { Test, TestingModule } from '@nestjs/testing';
import { ProductsRepository } from './products.repository';
import { PrismaService } from '../../database/database.service';
import { ElasticsearchService } from '../../services/elasticsearch/elasticsearch.service';
import { ProductsQueryDto, ProductSortBy, SellerType } from './dto/products.dto';
import { PaginationParamsDto } from '../../common/dto/pagination.dto';

const mockPrismaService = {
  product: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
  },
};

const mockElasticsearchService = {
  getClient: jest.fn(),
};

const mockElasticsearchClient = {
  search: jest.fn(),
  index: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
  indices: {
    exists: jest.fn(),
    create: jest.fn(),
  },
};

describe('ProductsRepository', () => {
  let repository: ProductsRepository;
  let prisma: PrismaService;
  let elasticsearch: ElasticsearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ElasticsearchService,
          useValue: mockElasticsearchService,
        },
      ],
    }).compile();

    repository = module.get<ProductsRepository>(ProductsRepository);
    prisma = module.get<PrismaService>(PrismaService);
    elasticsearch = module.get<ElasticsearchService>(ElasticsearchService);
    
    mockElasticsearchService.getClient.mockReturnValue(mockElasticsearchClient);
    jest.clearAllMocks();
  });

  describe('searchProducts', () => {
    it('should search products using Elasticsearch successfully', async () => {
      const searchTerm = 'test product';
      const paginationParams: PaginationParamsDto = { page: 1, limit: 20 };
      const productsQuery: ProductsQueryDto = { sortBy: ProductSortBy.RELEVANCE };

      const mockElasticsearchResponse = {
        hits: {
          total: { value: 5 },
          hits: [
            {
              _source: {
                id: 'prod1',
                name: 'Test Product',
                description: 'Test description',
                minPrice: 1000,
                maxPrice: 2000,
              },
              _score: 1.5,
            },
          ],
        },
        aggregations: {
          categories: { buckets: [] },
          seller_types: { buckets: [] },
          price_ranges: { buckets: [] },
        },
      };

      mockElasticsearchClient.search.mockResolvedValue(mockElasticsearchResponse);

      const result = await repository.searchProducts(
        searchTerm,
        paginationParams,
        productsQuery
      );

      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(5);
      expect(result.aggregations).toBeDefined();
      expect(mockElasticsearchClient.search).toHaveBeenCalledWith({
        index: 'products',
        body: expect.any(Object),
      });
    });

    it('should fallback to database search when Elasticsearch fails', async () => {
      const searchTerm = 'test product';
      const paginationParams: PaginationParamsDto = { page: 1, limit: 20 };
      const productsQuery: ProductsQueryDto = { sortBy: ProductSortBy.RELEVANCE };

      mockElasticsearchClient.search.mockRejectedValue(
        new Error('Elasticsearch connection failed')
      );

      mockPrismaService.product.findMany.mockResolvedValue([
        {
          id: 'prod1',
          name: 'Test Product',
          description: 'Test description',
          seller: {
            companyName: 'Test Seller',
            companyType: 'Manufacturer',
            isVerified: true,
          },
          categories: [{ category: { name: 'Electronics' } }],
          multiTierPricing: { retail: { price: 1000, moq: 10 } },
        },
      ]);

      mockPrismaService.product.count.mockResolvedValue(1);

      const result = await repository.searchProducts(
        searchTerm,
        paginationParams,
        productsQuery
      );

      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.aggregations).toBeNull();
      expect(mockPrismaService.product.findMany).toHaveBeenCalled();
    });

    it('should build correct Elasticsearch query for price filtering', async () => {
      const searchTerm = 'test';
      const paginationParams: PaginationParamsDto = { page: 1, limit: 20 };
      const productsQuery: ProductsQueryDto = {
        sortBy: ProductSortBy.RELEVANCE,
        filters: { priceMin: 1000, priceMax: 5000 },
      };

      mockElasticsearchClient.search.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
        aggregations: {},
      });

      await repository.searchProducts(searchTerm, paginationParams, productsQuery);

      const searchCall = mockElasticsearchClient.search.mock.calls[0][0];
      const query = searchCall.body.query;

      expect(query.bool.filter).toContainEqual({
        range: {
          minPrice: {
            gte: 1000,
            lte: 5000,
          },
        },
      });
    });

    it('should build correct Elasticsearch query for seller types', async () => {
      const searchTerm = 'test';
      const paginationParams: PaginationParamsDto = { page: 1, limit: 20 };
      const productsQuery: ProductsQueryDto = {
        sortBy: ProductSortBy.RELEVANCE,
        filters: { sellerTypes: [SellerType.MANUFACTURER, SellerType.WHOLESALER] },
      };

      mockElasticsearchClient.search.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
        aggregations: {},
      });

      await repository.searchProducts(searchTerm, paginationParams, productsQuery);

      const searchCall = mockElasticsearchClient.search.mock.calls[0][0];
      const query = searchCall.body.query;

      expect(query.bool.filter).toContainEqual({
        terms: {
          sellerType: [SellerType.MANUFACTURER, SellerType.WHOLESALER],
        },
      });
    });
  });

  describe('indexProduct', () => {
    it('should index product in Elasticsearch', async () => {
      const product = {
        id: 'prod1',
        name: 'Test Product',
        description: 'Test description',
        sellerId: 'seller1',
        seller: {
          companyName: 'Test Seller',
          companyType: 'Manufacturer',
          isVerified: true,
        },
        categories: [{ category: { name: 'Electronics' } }],
        multiTierPricing: {
          retail: { price: 1000, moq: 10 },
          wholesale: { price: 800, moq: 50 },
        },
        availabilityStatus: 'IN_STOCK',
        countryOfOrigin: 'India',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      mockElasticsearchClient.index.mockResolvedValue({});

      await repository.indexProduct(product);

      expect(mockElasticsearchClient.index).toHaveBeenCalledWith({
        index: 'products',
        id: 'prod1',
        body: {
          id: 'prod1',
          name: 'Test Product',
          description: 'Test description',
          categories: ['Electronics'],
          sellerId: 'seller1',
          sellerCompanyName: 'Test Seller',
          sellerType: 'Manufacturer',
          isVerified: true,
          pricingTiers: {
            retail: { price: 1000, moq: 10 },
            wholesale: { price: 800, moq: 50 },
          },
          minPrice: 800,
          maxPrice: 1000,
          availabilityStatus: 'IN_STOCK',
          countryOfOrigin: 'India',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
        refresh: true,
      });
    });

    it('should handle Elasticsearch indexing errors', async () => {
      const product = {
        id: 'prod1',
        name: 'Test Product',
        seller: { companyName: 'Test Seller', companyType: 'Manufacturer' },
        categories: [],
        multiTierPricing: {},
      };

      mockElasticsearchClient.index.mockRejectedValue(
        new Error('Indexing failed')
      );

      await expect(repository.indexProduct(product)).rejects.toThrow(
        'Indexing failed'
      );
    });
  });

  describe('deleteProductFromIndex', () => {
    it('should delete product from Elasticsearch index', async () => {
      mockElasticsearchClient.delete.mockResolvedValue({});

      await repository.deleteProductFromIndex('prod1');

      expect(mockElasticsearchClient.delete).toHaveBeenCalledWith({
        index: 'products',
        id: 'prod1',
        refresh: true,
      });
    });

    it('should ignore 404 errors when deleting non-existent product', async () => {
      mockElasticsearchClient.delete.mockRejectedValue({
        meta: { statusCode: 404 },
      });

      await expect(repository.deleteProductFromIndex('nonexistent')).resolves.not.toThrow();
    });

    it('should throw other errors when deleting product', async () => {
      mockElasticsearchClient.delete.mockRejectedValue(
        new Error('Permission denied')
      );

      await expect(repository.deleteProductFromIndex('prod1')).rejects.toThrow(
        'Permission denied'
      );
    });
  });

  describe('updateProductInIndex', () => {
    it('should update product in Elasticsearch index', async () => {
      const updates = { name: 'Updated Product', minPrice: 1500 };

      mockElasticsearchClient.update.mockResolvedValue({});

      await repository.updateProductInIndex('prod1', updates);

      expect(mockElasticsearchClient.update).toHaveBeenCalledWith({
        index: 'products',
        id: 'prod1',
        body: {
          doc: updates,
        },
        refresh: true,
      });
    });

    it('should re-index product when update fails', async () => {
      const updates = { name: 'Updated Product' };

      mockElasticsearchClient.update.mockRejectedValue(
        new Error('Update failed')
      );

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'prod1',
        name: 'Test Product',
        seller: {
          companyName: 'Test Seller',
          companyType: 'Manufacturer',
          isVerified: true,
        },
        categories: [{ category: { name: 'Electronics' } }],
        multiTierPricing: { retail: { price: 1000, moq: 10 } },
      });

      mockElasticsearchClient.index.mockResolvedValue({});

      await repository.updateProductInIndex('prod1', updates);

      expect(mockPrismaService.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod1' },
        include: expect.any(Object),
      });
      expect(mockElasticsearchClient.index).toHaveBeenCalled();
    });
  });

  describe('createIndexIfNotExists', () => {
    it('should create index if it does not exist', async () => {
      mockElasticsearchClient.indices.exists.mockResolvedValue(false);
      mockElasticsearchClient.indices.create.mockResolvedValue({});

      await repository.createIndexIfNotExists();

      expect(mockElasticsearchClient.indices.create).toHaveBeenCalledWith({
        index: 'products',
        body: {
          mappings: expect.any(Object),
          settings: expect.any(Object),
        },
      });
    });

    it('should not create index if it already exists', async () => {
      mockElasticsearchClient.indices.exists.mockResolvedValue(true);

      await repository.createIndexIfNotExists();

      expect(mockElasticsearchClient.indices.create).not.toHaveBeenCalled();
    });

    it('should handle index creation errors', async () => {
      mockElasticsearchClient.indices.exists.mockResolvedValue(false);
      mockElasticsearchClient.indices.create.mockRejectedValue(
        new Error('Creation failed')
      );

      await expect(repository.createIndexIfNotExists()).resolves.not.toThrow();
    });
  });

  describe('price calculation', () => {
    it('should calculate min price from pricing tiers', () => {
      const pricingTiers = {
        retail: { price: 1000, moq: 10 },
        wholesale: { price: 800, moq: 50 },
        bulk: { price: 600, moq: 100 },
      };

      const minPrice = (repository as any).calculateMinPrice(pricingTiers);
      expect(minPrice).toBe(600);
    });

    it('should calculate max price from pricing tiers', () => {
      const pricingTiers = {
        retail: { price: 1000, moq: 10 },
        wholesale: { price: 800, moq: 50 },
        bulk: { price: 600, moq: 100 },
      };

      const maxPrice = (repository as any).calculateMaxPrice(pricingTiers);
      expect(maxPrice).toBe(1000);
    });

    it('should return 0 for invalid pricing tiers', () => {
      expect((repository as any).calculateMinPrice(null)).toBe(0);
      expect((repository as any).calculateMaxPrice(undefined)).toBe(0);
      expect((repository as any).calculateMinPrice({})).toBe(0);
    });
  });
});