import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CategoryProductsQueryDto, ProductsQueryDto, ProductSortBy } from './dto/products.dto';
import { PaginationParamsDto } from '../../common/dto/pagination.dto';

const mockProductsService = {
  getCategoryProducts: jest.fn(),
  getCategoriesWithProductCounts: jest.fn(),
  getCategoryById: jest.fn(),
  getProductDetail: jest.fn(),
  searchProducts: jest.fn(),
};

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  describe('getCategoryProducts', () => {
    it('should return paginated products for a category', async () => {
      const mockResult = {
        data: [
          {
            id: 'prod1',
            name: 'Test Product',
            image: 'test.jpg',
            sellerCompanyName: 'Test Seller',
            sellerType: 'Manufacturer',
            isVerified: true,
            pricingTiers: [{ tier: 'retail', price: 1000, moq: 10 }],
            sellerState: 'TN',
            verificationBadges: ['GST Verified'],
            createdAt: '2024-01-01',
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
          offset: 0,
        },
      };

      mockProductsService.getCategoryProducts.mockResolvedValue(mockResult);

      const query: CategoryProductsQueryDto = { page: 1, limit: 20, sortBy: ProductSortBy.RELEVANCE };

      const result = await controller.getCategoryProducts('cat1', query);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(service.getCategoryProducts).toHaveBeenCalledWith('cat1', query);
    });

    it('should handle category not found error', async () => {
      mockProductsService.getCategoryProducts.mockRejectedValue(
        new NotFoundException('Category not found')
      );

      const query: CategoryProductsQueryDto = { page: 1, limit: 20, sortBy: ProductSortBy.RELEVANCE };

      await expect(
        controller.getCategoryProducts('invalid', query)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCategoriesWithCounts', () => {
    it('should return categories with product counts', async () => {
      const mockCategories = [
        {
          id: 'cat1',
          name: 'Electronics',
          productCount: 10,
          children: [],
        },
      ];

      mockProductsService.getCategoriesWithProductCounts.mockResolvedValue(mockCategories);

      const result = await controller.getCategoriesWithCounts();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCategories);
      expect(service.getCategoriesWithProductCounts).toHaveBeenCalled();
    });
  });

  describe('getProductDetail', () => {
    it('should return product details', async () => {
      const mockProduct = {
        id: 'prod1',
        name: 'Test Product',
        description: 'Test description',
        image: 'test.jpg',
        sellerCompanyName: 'Test Seller',
        sellerType: 'Manufacturer',
        isVerified: true,
        pricingTiers: [{ tier: 'retail', price: 1000, moq: 10 }],
        sellerState: 'TN',
        verificationBadges: ['GST Verified'],
        createdAt: '2024-01-01',
        sellerId: 'seller1',
        hsnCode: '123456',
        countryOfOrigin: 'India',
        availabilityStatus: 'IN_STOCK',
        categories: ['Electronics'],
        images: ['test.jpg'],
        viewCount: 100,
        relatedProducts: [],
      };

      mockProductsService.getProductDetail.mockResolvedValue(mockProduct);

      const result = await controller.getProductDetail('prod1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProduct);
      expect(service.getProductDetail).toHaveBeenCalledWith('prod1');
    });

    it('should handle product not found error', async () => {
      mockProductsService.getProductDetail.mockRejectedValue(
        new NotFoundException('Product not found')
      );

      await expect(controller.getProductDetail('invalid')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('searchProducts', () => {
    it('should search products with filters', async () => {
      const mockResult = {
        data: [
          {
            id: 'prod1',
            name: 'Test Product',
            image: 'test.jpg',
            sellerCompanyName: 'Test Seller',
            sellerType: 'Manufacturer',
            isVerified: true,
            pricingTiers: [{ tier: 'retail', price: 1000, moq: 10 }],
            sellerState: 'TN',
            verificationBadges: ['GST Verified'],
            createdAt: '2024-01-01',
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
          offset: 0,
        },
      };

      mockProductsService.searchProducts.mockResolvedValue(mockResult);

      const paginationParams: PaginationParamsDto = { page: 1, limit: 20 };
      const productsQuery: ProductsQueryDto = { sortBy: ProductSortBy.RELEVANCE };

      const result = await controller.searchProducts(
        paginationParams,
        productsQuery,
        'test'
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(service.searchProducts).toHaveBeenCalledWith(
        paginationParams,
        productsQuery,
        'test'
      );
    });
  });
});
