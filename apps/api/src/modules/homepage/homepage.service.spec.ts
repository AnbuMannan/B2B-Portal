import { Test, TestingModule } from '@nestjs/testing';
import { HomepageService } from './homepage.service';
import { RedisService } from '../../services/redis/redis.service';
import { PrismaService } from '../../database/database.service';

// Mock Redis service
const mockRedisService = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

const mockPrismaService = {
  category: {
    findMany: jest.fn(),
  },
  seller: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  buyLead: {
    findMany: jest.fn(),
  },
};

describe('HomepageService', () => {
  let service: HomepageService;
  let redisService: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomepageService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<HomepageService>(HomepageService);
    redisService = module.get<RedisService>(RedisService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('getCategories', () => {
    it('should return categories from cache if available', async () => {
      const cachedCategories = {
        categories: [
          { id: '1', name: 'Electronics', industryType: ['Manufacturing'] },
        ],
      };

      mockRedisService.get.mockResolvedValue(cachedCategories);

      const result = await service.getCategories();

      expect(result).toEqual(cachedCategories);
      expect(mockRedisService.get).toHaveBeenCalledWith('homepage:categories');
      expect(mockPrismaService.category.findMany).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache for 24 hours if not in cache', async () => {
      const dbCategories = {
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
              },
            ],
          },
        ],
      };

      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.category.findMany.mockResolvedValue([
        {
          id: 'electronics',
          name: 'Electronics',
          industryType: ['Manufacturing', 'Components'],
          parent: null,
          children: [
            {
              id: 'mobile-phones',
              name: 'Mobile Phones',
              industryType: ['Devices'],
              parentId: 'electronics',
              children: [],
            },
          ],
        },
      ]);

      const result = await service.getCategories();

      expect(result.categories.length).toBeGreaterThan(0);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'homepage:categories',
        expect.any(Object),
        86400 // 24 hours in seconds
      );
      expect(mockPrismaService.category.findMany).toHaveBeenCalled();
    });

    it('should build hierarchical category tree with 3+ levels', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.category.findMany.mockResolvedValue([
        {
          id: 'electronics',
          name: 'Electronics',
          industryType: ['Manufacturing'],
          parent: null,
          children: [
            {
              id: 'mobile-phones',
              name: 'Mobile Phones',
              industryType: ['Devices'],
              parentId: 'electronics',
              children: [
                {
                  id: 'accessories',
                  name: 'Accessories',
                  industryType: ['Components'],
                  parentId: 'mobile-phones',
                  children: [],
                },
              ],
            },
          ],
        },
      ]);

      const result = await service.getCategories();

      // Verify hierarchical structure
      const electronicsCategory = result.categories[0];
      expect(electronicsCategory.children).toBeDefined();
      expect(electronicsCategory.children!.length).toBeGreaterThan(0);
      
      const mobilePhonesCategory = electronicsCategory.children![0];
      expect(mobilePhonesCategory.children).toBeDefined();
      expect(mobilePhonesCategory.children!.length).toBeGreaterThan(0);
      
      const accessoriesCategory = mobilePhonesCategory.children![0];
      expect(accessoriesCategory.name).toBe('Accessories');
    });
  });

  describe('getFeaturedSellers', () => {
    it('should return featured sellers with proper badge structure', async () => {
      const mockSellers = [
        {
          id: 'seller-1',
          companyName: 'TechCorp India',
          isVerified: true,
          kycStatus: 'APPROVED',
          gstNumber: 'GST123',
          iecCode: 'IEC456',
          companyType: 'PRIVATE_LIMITED',
          user: {
            createdAt: new Date('2020-01-01'),
          },
          products: [{}, {}, {}], // 3 products
        },
      ];

      mockPrismaService.seller.findMany.mockResolvedValue(mockSellers);

      const result = await service.getFeaturedSellers();

      expect(result.sellers.length).toBeGreaterThan(0);
      const seller = result.sellers[0];
      
      // Verify seller has proper structure
      expect(seller.companyName).toBe('TechCorp India');
      expect(seller.badges).toBeDefined();
      expect(seller.productCount).toBe(3);
      expect(seller.yearsInBusiness).toBeDefined();
      
      // Verify badges include GST_VERIFIED
      const hasGstVerified = seller.badges.some(badge => badge.type === 'GST_VERIFIED');
      expect(hasGstVerified).toBe(true);
    });

    it('should return 6-8 featured sellers', async () => {
      // Create mock sellers array with 8 sellers
      const mockSellers = Array.from({ length: 8 }, (_, i) => ({
        id: `seller-${i + 1}`,
        companyName: `Company ${i + 1}`,
        isVerified: true,
        kycStatus: 'APPROVED',
        gstNumber: `GST${i + 1}`,
        iecCode: `IEC${i + 1}`,
        companyType: 'PRIVATE_LIMITED',
        user: {
          createdAt: new Date('2020-01-01'),
        },
        products: Array.from({ length: i + 1 }),
      }));

      mockPrismaService.seller.findMany.mockResolvedValue(mockSellers);

      const result = await service.getFeaturedSellers();

      // Should return exactly 8 sellers
      expect(result.sellers.length).toBe(8);
      
      // Verify all sellers are verified and have GST badges
      result.sellers.forEach(seller => {
        expect(seller.badges.some(b => b.type === 'GST_VERIFIED')).toBe(true);
      });
    });

    it('should cache featured sellers in Redis', async () => {
      mockPrismaService.seller.findMany.mockResolvedValue([]);

      await service.getFeaturedSellers();

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'homepage:featured-sellers',
        expect.any(Object),
        expect.any(Number)
      );
    });
  });

  describe('getLatestBuyLeads', () => {
    it('should return latest 5 buy leads with country flags', async () => {
      const mockBuyLeads = [
        {
          id: 'lead-1',
          productName: 'Electronics Components',
          quantity: '1000 units',
          buyer: {
            companyCountry: 'India',
          },
          createdAt: new Date(),
        },
        {
          id: 'lead-2',
          productName: 'Textile Materials',
          quantity: '5000 kg',
          buyer: {
            companyCountry: 'USA',
          },
          createdAt: new Date(Date.now() - 1000),
        },
        // Add 3 more leads
      ];

      // Fill with 5 total leads
      while (mockBuyLeads.length < 5) {
        mockBuyLeads.push({
          id: `lead-${mockBuyLeads.length + 1}`,
          productName: `Product ${mockBuyLeads.length + 1}`,
          quantity: `${1000 + mockBuyLeads.length * 500} units`,
          buyer: {
            companyCountry: 'India',
          },
          createdAt: new Date(Date.now() - mockBuyLeads.length * 1000),
        });
      }

      mockPrismaService.buyLead.findMany.mockResolvedValue(mockBuyLeads);

      const result = await service.getLatestBuyLeads();

      expect(result.leads.length).toBe(5);
      
      // Verify all leads have country flags
      result.leads.forEach(lead => {
        expect(lead.country).toBeDefined();
        expect(lead.flag).toBeDefined();
        expect(lead.productName).toBeDefined();
        expect(lead.quantity).toBeDefined();
      });

      // Verify leads are ordered by creation date (newest first)
      const creationDates = result.leads.map(lead => 
        new Date(mockBuyLeads.find(l => l.productName === lead.productName)?.createdAt || 0)
      );
      
      for (let i = 0; i < creationDates.length - 1; i++) {
        expect(creationDates[i].getTime()).toBeGreaterThanOrEqual(creationDates[i + 1].getTime());
      }
    });

    it('should cache buy leads for 5 minutes in Redis', async () => {
      mockPrismaService.buyLead.findMany.mockResolvedValue([]);

      await service.getLatestBuyLeads();

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'homepage:latest-buy-leads',
        expect.any(Object),
        300 // 5 minutes in seconds
      );
    });

    it('should return from cache if available', async () => {
      const cachedLeads = {
        leads: [
          {
            productName: 'Cached Product',
            quantity: '100 units',
            country: 'Test Country',
            flag: '🇺🇳',
          },
        ],
      };

      mockRedisService.get.mockResolvedValue(cachedLeads);

      const result = await service.getLatestBuyLeads();

      expect(result).toEqual(cachedLeads);
      expect(mockPrismaService.buyLead.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Redis Caching', () => {
    it('should use Redis for categories cache with 24h TTL', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.category.findMany.mockResolvedValue([]);

      await service.getCategories();

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'homepage:categories',
        expect.any(Object),
        86400 // 24 hours
      );
    });

    it('should use Redis for buy leads cache with 5m TTL', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.buyLead.findMany.mockResolvedValue([]);

      await service.getLatestBuyLeads();

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'homepage:latest-buy-leads',
        expect.any(Object),
        300 // 5 minutes
      );
    });

    it('should return cached data for subsequent calls', async () => {
      const cachedData = { categories: [{ id: '1', name: 'Cached' }] };
      mockRedisService.get.mockResolvedValue(cachedData);

      const result1 = await service.getCategories();
      const result2 = await service.getCategories();

      expect(result1).toEqual(cachedData);
      expect(result2).toEqual(cachedData);
      // Should only call database once (but cache hit for second call)
      expect(mockPrismaService.category.findMany).not.toHaveBeenCalled();
    });
  });
});