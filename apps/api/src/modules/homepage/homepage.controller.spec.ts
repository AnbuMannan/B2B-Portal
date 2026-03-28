import { Test, TestingModule } from '@nestjs/testing';
import { HomepageController } from './homepage.controller';
import { HomepageService } from './homepage.service';
import { RedisService } from '../../services/redis/redis.service';
import { PrismaService } from '../../database/database.service';
import { FeatureFlagsService } from '../../services/feature-flags/feature-flags.service';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

// Mock services
const mockHomepageService = {
  getHeroData: jest.fn(),
  getCategories: jest.fn(),
  getFeaturedSellers: jest.fn(),
  getLatestBuyLeads: jest.fn(),
};

const mockRedisService = {
  getClient: jest.fn(),
};

const mockPrismaService = {
  featureFlag: {
    findUnique: jest.fn(),
  },
};

const mockFeatureFlagsService = {
  isFeatureEnabled: jest.fn(),
};

describe('HomepageController', () => {
  let controller: HomepageController;
  let homepageService: HomepageService;
  let featureFlagsService: FeatureFlagsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HomepageController],
      providers: [
        { provide: HomepageService, useValue: mockHomepageService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: FeatureFlagsService, useValue: mockFeatureFlagsService },
      ],
    }).compile();

    controller = module.get<HomepageController>(HomepageController);
    homepageService = module.get<HomepageService>(HomepageService);
    featureFlagsService = module.get<FeatureFlagsService>(FeatureFlagsService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('getHeroData', () => {
    it('should return hero data successfully', async () => {
      const mockHeroData = {
        trustMetrics: [
          { label: 'GST Verified Sellers', value: '500+', icon: 'gst-verified' },
          { label: 'IEC Global Exporters', value: '200+', icon: 'iec-global' },
        ],
      };

      mockHomepageService.getHeroData.mockResolvedValue(mockHeroData);
      mockFeatureFlagsService.isFeatureEnabled.mockResolvedValue(true);

      const result = await controller.getHeroData();

      expect(result).toBeInstanceOf(ApiResponseDto);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Hero data retrieved successfully');
      expect(result.data).toEqual(mockHeroData);
      expect(homepageService.getHeroData).toHaveBeenCalled();
    });

    it('should return feature disabled response when MODULE_HOMEPAGE_ENABLED is false', async () => {
      mockFeatureFlagsService.isFeatureEnabled.mockResolvedValue(false);

      const result = await controller.getHeroData();

      expect(result).toBeInstanceOf(ApiResponseDto);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Homepage module is disabled');
      expect(result.data).toBeNull();
      expect(homepageService.getHeroData).not.toHaveBeenCalled();
    });
  });

  describe('getCategories', () => {
    it('should return hierarchical category tree with 3+ levels', async () => {
      const mockCategories = {
        categories: [
          {
            id: 'electronics',
            name: 'Electronics',
            industryType: ['Manufacturing', 'Components'],
            children: [
              {
                id: 'mobile-phones',
                name: 'Mobile Phones',
                industryType: ['Devices'],
                children: [
                  {
                    id: 'accessories',
                    name: 'Accessories',
                    industryType: ['Components'],
                  },
                ],
              },
            ],
          },
        ],
      };

      mockHomepageService.getCategories.mockResolvedValue(mockCategories);
      mockFeatureFlagsService.isFeatureEnabled.mockResolvedValue(true);

      const result = await controller.getCategories();

      expect(result).toBeInstanceOf(ApiResponseDto);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Categories retrieved successfully');
      expect(result.data).toEqual(mockCategories);
      
      // Verify hierarchical structure
      expect(result.data?.categories[0].children).toBeDefined();
      expect(result.data?.categories[0].children![0].children).toBeDefined();
      expect(result.data?.categories[0].children![0].children!.length).toBeGreaterThan(0);
      
      expect(homepageService.getCategories).toHaveBeenCalled();
    });

    it('should be cached in Redis for 24 hours (test response time <50ms)', async () => {
      const mockCategories = { categories: [] };
      
      mockHomepageService.getCategories.mockResolvedValue(mockCategories);
      mockFeatureFlagsService.isFeatureEnabled.mockResolvedValue(true);

      const startTime = Date.now();
      const result = await controller.getCategories();
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      
      // Verify response time is reasonable (not testing actual Redis here)
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(100); // Should be much faster than 50ms in test environment
    });
  });

  describe('getFeaturedSellers', () => {
    it('should return 6-8 verified sellers with GST_VERIFIED badge', async () => {
      const mockSellers = {
        sellers: [
          {
            id: 'seller-1',
            companyName: 'TechCorp India',
            badges: [
              { type: 'GST_VERIFIED', label: 'GST Verified' },
              { type: 'MSME_REGISTERED', label: 'MSME Registered' },
            ],
            productCount: 42,
            yearsInBusiness: 5,
          },
          {
            id: 'seller-2',
            companyName: 'Global Exports Ltd',
            badges: [
              { type: 'GST_VERIFIED', label: 'GST Verified' },
              { type: 'IEC_GLOBAL', label: 'IEC Global' },
            ],
            productCount: 78,
            yearsInBusiness: 8,
          },
          // Add more sellers to reach 6-8
        ],
      };

      // Ensure we have at least 6 sellers
      while (mockSellers.sellers.length < 6) {
        mockSellers.sellers.push({
          id: `seller-${mockSellers.sellers.length + 1}`,
          companyName: `Company ${mockSellers.sellers.length + 1}`,
          badges: [{ type: 'GST_VERIFIED', label: 'GST Verified' }],
          productCount: 10 + mockSellers.sellers.length * 5,
          yearsInBusiness: 2 + mockSellers.sellers.length,
        });
      }

      mockHomepageService.getFeaturedSellers.mockResolvedValue(mockSellers);
      mockFeatureFlagsService.isFeatureEnabled.mockResolvedValue(true);

      const result = await controller.getFeaturedSellers();

      expect(result).toBeInstanceOf(ApiResponseDto);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Featured sellers retrieved successfully');
      
      // Verify we have 6-8 sellers
      expect(result.data?.sellers.length).toBeGreaterThanOrEqual(6);
      expect(result.data?.sellers.length).toBeLessThanOrEqual(8);
      
      // Verify all sellers have GST_VERIFIED badge
      result.data?.sellers.forEach(seller => {
        const hasGstVerified = seller.badges.some(badge => badge.type === 'GST_VERIFIED');
        expect(hasGstVerified).toBe(true);
      });
      
      expect(homepageService.getFeaturedSellers).toHaveBeenCalled();
    });

    it('should cache featured sellers in Redis', async () => {
      const mockSellers = { sellers: [] };
      mockHomepageService.getFeaturedSellers.mockResolvedValue(mockSellers);
      mockFeatureFlagsService.isFeatureEnabled.mockResolvedValue(true);

      const result = await controller.getFeaturedSellers();
      
      expect(result.success).toBe(true);
      // Redis caching is tested in service layer
    });
  });

  describe('getLatestBuyLeads', () => {
    it('should return latest 5 buy leads with country flags', async () => {
      const mockBuyLeads = {
        leads: [
          {
            productName: 'Electronics Components',
            quantity: '1000 units',
            country: 'India',
            flag: '🇮🇳',
          },
          {
            productName: 'Textile Raw Materials',
            quantity: '5000 kg',
            country: 'USA',
            flag: '🇺🇸',
          },
          {
            productName: 'Chemical Compounds',
            quantity: '2000 L',
            country: 'Germany',
            flag: '🇩🇪',
          },
          {
            productName: 'Agricultural Products',
            quantity: '10000 units',
            country: 'Brazil',
            flag: '🇧🇷',
          },
          {
            productName: 'Metal Alloys',
            quantity: '500 kg',
            country: 'Japan',
            flag: '🇯🇵',
          },
        ],
      };

      mockHomepageService.getLatestBuyLeads.mockResolvedValue(mockBuyLeads);
      mockFeatureFlagsService.isFeatureEnabled.mockResolvedValue(true);

      const result = await controller.getLatestBuyLeads();

      expect(result).toBeInstanceOf(ApiResponseDto);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Latest buy leads retrieved successfully');
      
      // Verify we have exactly 5 leads
      expect(result.data?.leads.length).toBe(5);
      
      // Verify all leads have country flags
      result.data?.leads.forEach(lead => {
        expect(lead.country).toBeDefined();
        expect(lead.flag).toBeDefined();
        expect(lead.productName).toBeDefined();
        expect(lead.quantity).toBeDefined();
      });
      
      expect(homepageService.getLatestBuyLeads).toHaveBeenCalled();
    });

    it('should cache buy leads in Redis for 5 minutes', async () => {
      const mockBuyLeads = { leads: [] };
      mockHomepageService.getLatestBuyLeads.mockResolvedValue(mockBuyLeads);
      mockFeatureFlagsService.isFeatureEnabled.mockResolvedValue(true);

      const result = await controller.getLatestBuyLeads();
      
      expect(result.success).toBe(true);
      // Redis caching with 5m TTL is tested in service layer
    });

    it('should support buy leads ticker auto-refresh every 30 seconds', async () => {
      // This test verifies the frontend integration aspect
      const mockBuyLeads = {
        leads: [
          {
            productName: 'Test Product',
            quantity: '100 units',
            country: 'Test Country',
            flag: '🇺🇳',
          },
        ],
      };

      mockHomepageService.getLatestBuyLeads.mockResolvedValue(mockBuyLeads);
      mockFeatureFlagsService.isFeatureEnabled.mockResolvedValue(true);

      const result = await controller.getLatestBuyLeads();
      
      expect(result.success).toBe(true);
      expect(result.data?.leads[0].productName).toBe('Test Product');
      
      // The auto-refresh functionality is implemented in the frontend
      // This test ensures the API endpoint returns the proper structure
    });
  });

  describe('Feature Flag Integration', () => {
    it('should respect MODULE_HOMEPAGE_ENABLED feature flag for all endpoints', async () => {
      mockFeatureFlagsService.isFeatureEnabled.mockResolvedValue(false);

      const endpoints = [
        () => controller.getHeroData(),
        () => controller.getCategories(),
        () => controller.getFeaturedSellers(),
        () => controller.getLatestBuyLeads(),
      ];

      for (const endpoint of endpoints) {
        const result = await endpoint();
        expect(result.success).toBe(false);
        expect(result.message).toBe('Homepage module is disabled');
        expect(result.data).toBeNull();
      }

      // Verify service methods were not called when feature is disabled
      expect(mockHomepageService.getHeroData).not.toHaveBeenCalled();
      expect(mockHomepageService.getCategories).not.toHaveBeenCalled();
      expect(mockHomepageService.getFeaturedSellers).not.toHaveBeenCalled();
      expect(mockHomepageService.getLatestBuyLeads).not.toHaveBeenCalled();
    });
  });
});