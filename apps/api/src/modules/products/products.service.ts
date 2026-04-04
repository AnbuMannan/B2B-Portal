import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/database.service';
import { RedisService } from '../../services/redis/redis.service';
// import { ElasticsearchService } from '../../services/elasticsearch/elasticsearch.service'; // TODO: Enable when Elasticsearch is available
import { ProductsQueryDto, CategoryProductsQueryDto, ProductResponseDto, ProductDetailResponseDto, ProductSortBy, CreateEnquiryDto } from './dto/products.dto';
import { PaginationParamsDto, PaginatedResponseDto, PaginationMetaDto } from '../../common/dto/pagination.dto';
import { CacheInvalidationService } from '../../common/services/cache-invalidation.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    // private readonly elasticsearchService: ElasticsearchService, // TODO: Enable when Elasticsearch is available
    private readonly cacheInvalidation: CacheInvalidationService,
    @InjectQueue('search-sync') private readonly searchSyncQueue: Queue,
  ) {}

  async getCategoryBreadcrumb(categoryId: string): Promise<any[]> {
    const breadcrumb: any[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      const category: { id: string; name: string; parentId: string | null } | null =
        await this.prisma.category.findUnique({
          where: { id: currentId },
          select: { id: true, name: true, parentId: true },
        });

      if (!category) break;

      breadcrumb.unshift({ id: category.id, name: category.name });
      currentId = (category as any).parentId ?? null;

      if (breadcrumb.length >= 5) break;
    }

    return breadcrumb;
  }

  async getCategoryById(categoryId: string): Promise<any> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        children: {
          include: {
            productLinks: { select: { productId: true } },
          },
        },
        productLinks: { select: { productId: true } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    return {
      id: category.id,
      name: category.name,
      parentId: (category as any).parentId ?? null,
      productCount: (category as any).productLinks?.length ?? 0,
      children: (category as any).children?.map((child: any) => ({
        id: child.id,
        name: child.name,
        productCount: child.productLinks?.length ?? 0,
      })) ?? [],
    };
  }

  async getCategoryProducts(
    categoryId: string,
    query: CategoryProductsQueryDto,
  ): Promise<PaginatedResponseDto<ProductResponseDto>> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const sortBy = query.sortBy;
    // Map flat query fields into the filters shape buildWhereClause expects
    const filters = {
      priceMin: query.priceMin,
      priceMax: query.priceMax,
      state: query.state,
      verifiedOnly: query.verifiedOnly,
      iecGlobal: query.iecGlobal,
      sellerTypes: query.sellerTypes,
      verificationBadges: query.verificationBadges,
    };

    // Verify category exists
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    // Build where clause for filtering
    const whereClause = this.buildWhereClause(categoryId, filters);

    // Build orderBy clause for sorting
    const orderByClause = this.buildOrderByClause(sortBy);

    // Get total count
    const total = await this.prisma.product.count({
      where: whereClause,
    });

    // Get paginated products
    const products = await this.prisma.product.findMany({
      where: whereClause,
      orderBy: orderByClause,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        seller: {
          select: {
            companyName: true,
            companyType: true,
            isVerified: true,
            gstNumber: true,
            iecCode: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    // Transform to response DTO
    const productDtos = products.map((product: any) => this.transformToProductDto(product));

    // Track product view (async)
    this.trackProductViews(products.map((p: any) => p.id));

    return new PaginatedResponseDto(
      productDtos,
      new PaginationMetaDto(page, limit, total)
    );
  }

  async getCategoriesWithProductCounts(): Promise<any> {
    const cacheKey = 'categories:with-product-counts';
    const cached = await this.redis.get<any>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const categories = await this.prisma.category.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            productLinks: {
              select: {
                productId: true,
              },
            },
          },
        },
        productLinks: {
          select: {
            productId: true,
          },
        },
      },
    });

    const result = categories.map((category: any) => ({
      id: category.id,
      name: category.name,
      productCount: category.productLinks.length,
      children: category.children.map((child: any) => ({
        id: child.id,
        name: child.name,
        productCount: child.productLinks.length,
      })),
    }));

    // Cache for 24 hours
    await this.redis.set(cacheKey, result, 24 * 60 * 60);

    return result;
  }

  async getProductDetail(id: string): Promise<ProductDetailResponseDto> {
    // Check Redis cache first (1 hour TTL)
    const cacheKey = `product:detail:${id}`;
    const cached = await this.redis.get<ProductDetailResponseDto>(cacheKey);
    if (cached) {
      // Still track the view even on cache hit (async, non-blocking)
      this.trackProductViews([id]);
      return cached;
    }

    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            id: true,
            companyName: true,
            companyType: true,
            isVerified: true,
            gstNumber: true,
            iecCode: true,
            city: true,
            state: true,
          },
        },
        categories: {
          include: { category: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Related products: same category, different seller, max 5
    const categoryIds = product.categories.map((pc: any) => pc.categoryId);
    const relatedProducts = await this.prisma.product.findMany({
      where: {
        id: { not: id },
        sellerId: { not: product.sellerId },
        isActive: true,
        adminApprovalStatus: 'APPROVED' as any,
        ...(categoryIds.length > 0 && {
          categories: { some: { categoryId: { in: categoryIds } } },
        }),
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        seller: {
          select: {
            companyName: true,
            companyType: true,
            isVerified: true,
            gstNumber: true,
            iecCode: true,
          },
        },
      },
    });

    const result = this.transformToProductDetailDto(product, relatedProducts);

    // Cache for 1 hour
    await this.redis.set(cacheKey, result, 60 * 60);

    // Track view (async, non-blocking)
    this.trackProductViews([id]);

    return result;
  }

  /**
   * Create a buy lead (enquiry) for a product. Caller must be a registered buyer.
   */
  async createEnquiry(
    productId: string,
    userId: string,
    dto: CreateEnquiryDto,
  ): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, isActive: true, adminApprovalStatus: true },
    });

    if (!product || !product.isActive || product.adminApprovalStatus !== 'APPROVED') {
      throw new NotFoundException('Product not found or is no longer available');
    }

    const buyer = await this.prisma.buyer.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!buyer) {
      throw new ForbiddenException(
        'Only registered buyers can submit enquiries. Please complete buyer registration.',
      );
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // 30-day expiry

    await this.prisma.buyLead.create({
      data: {
        buyerId: buyer.id,
        productName: product.name,
        quantity: dto.quantity,
        unit: dto.unit,
        targetPriceMin: dto.targetPriceMin ?? null,
        targetPriceMax: dto.targetPriceMax ?? null,
        contactChannel: dto.contactChannel as any,
        expiryDate,
        expiresAt: expiryDate,
        isOpen: true,
        repeatOption: 'NONE' as any,
      },
    });

    this.logger.log(
      `Enquiry created: product=${productId}, buyer=${buyer.id}, qty=${dto.quantity} ${dto.unit}`,
    );
  }

  async searchProducts(
    paginationParams: PaginationParamsDto,
    productsQuery: ProductsQueryDto,
    searchTerm?: string
  ): Promise<PaginatedResponseDto<ProductResponseDto>> {
    if (!searchTerm) {
      // Build a flat query from the two separate DTOs
      const flatQuery = {
        page: paginationParams.page,
        limit: paginationParams.limit,
        sortBy: productsQuery.sortBy,
        ...(productsQuery.filters ?? {}),
      } as any;
      return this.getCategoryProducts('', flatQuery);
    }

    // TODO: Elasticsearch is disabled. Using Prisma full-text search fallback.
    // Uncomment below when Elasticsearch is available.
    // try {
    //   const page = paginationParams.page || 1;
    //   const limit = paginationParams.limit || 20;

    //   const results = await this.elasticsearchService.search({
    //     index: 'products',
    //     body: {
    //       from: (page - 1) * limit,
    //       size: limit,
    //       query: {
    //         bool: {
    //           must: [
    //             {
    //               multi_match: {
    //                 query: searchTerm,
    //                 fields: ['name^3', 'description^2', 'name.hinglish'],
    //                 fuzziness: 'AUTO',
    //                 operator: 'or',
    //               },
    //             },
    //           ],
    //           filter: [
    //             { term: { isActive: true } },
    //             { term: { adminApprovalStatus: 'APPROVED' } },
    //           ],
    //         },
    //       },
    //       sort: [
    //         { _score: { order: 'desc' } },
    //         { createdAt: { order: 'desc' } },
    //       ],
    //     },
    //   });

    //   const total = results.hits.total instanceof Object ? results.hits.total.value : (results.hits.total || 0);
    //   const products = results.hits.hits.map((hit: any) => ({
    //     id: hit._id,
    //     ...hit._source,
    //   }));

    //   // Transform hits to ProductResponseDto
    //   const productDtos = products.map((p: any) => this.transformToProductDtoFromES(p));

    //   return new PaginatedResponseDto(
    //     productDtos,
    //     new PaginationMetaDto(page, limit, total)
    //   );
    // } catch (error) {
    //   this.logger.error(`Elasticsearch search failed, falling back to Prisma: ${error.message}`);
    //   return this.getPrismaFullTextSearch(searchTerm, paginationParams);
    // }
    return this.getPrismaFullTextSearch(searchTerm, paginationParams);
  }

  private async getPrismaFullTextSearch(
    searchTerm: string,
    paginationParams: PaginationParamsDto
  ): Promise<PaginatedResponseDto<ProductResponseDto>> {
    const page = paginationParams.page || 1;
    const limit = paginationParams.limit || 20;
    
    const where: any = {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' as any } },
        { description: { contains: searchTerm, mode: 'insensitive' as any } },
      ],
      isActive: true,
      adminApprovalStatus: { equals: 'APPROVED' as any }, // Use enum format
    };

    const total = await this.prisma.product.count({ where: where as any });
    const products = await this.prisma.product.findMany({
      where: where as any,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        seller: {
          select: {
            companyName: true,
            companyType: true,
            isVerified: true,
            gstNumber: true,
            iecCode: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    return new PaginatedResponseDto(
      products.map((p: any) => this.transformToProductDto(p)),
      new PaginationMetaDto(page, limit, total)
    );
  }

  private transformToProductDtoFromES(product: any): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      image: product.primaryImage || '',
      sellerCompanyName: product.sellerCompanyName,
      sellerType: product.sellerType,
      isVerified: product.isVerified,
      pricingTiers: product.pricingTiers || [],
      sellerState: product.sellerState || 'TN',
      verificationBadges: product.verificationBadges || [],
      createdAt: product.createdAt,
    };
  }

  @OnEvent('product.created')
  async handleProductCreated(event: { productId: string }) {
    await this.searchSyncQueue.add('search-sync', {
      entityType: 'PRODUCT',
      entityId: event.productId,
      action: 'CREATE',
      requestId: `sync-${event.productId}-${Date.now()}`,
    });
  }

  @OnEvent('product.updated')
  async handleProductUpdated(event: { productId: string }) {
    await this.searchSyncQueue.add('search-sync', {
      entityType: 'PRODUCT',
      entityId: event.productId,
      action: 'UPDATE',
      requestId: `sync-${event.productId}-${Date.now()}`,
    });
  }

  @OnEvent('product.deleted')
  async handleProductDeleted(event: { productId: string }) {
    await this.searchSyncQueue.add('search-sync', {
      entityType: 'PRODUCT',
      entityId: event.productId,
      action: 'DELETE',
      requestId: `sync-${event.productId}-${Date.now()}`,
    });
  }

  private buildWhereClause(categoryId: string, filters?: any) {
    const where: any = {
      isActive: true,
      adminApprovalStatus: { equals: 'APPROVED' as any },
    };

    if (categoryId) {
      where.categories = {
        some: {
          categoryId,
        },
      };
    }

    if (filters) {
      // Price filtering
      if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
        // For JSONB filtering, we need to check all tiers 
        // This query checks if any tier's price falls within the range 
        const priceConditions = [];

        if (filters.priceMin !== undefined) {
          priceConditions.push({
            OR: [
              { multiTierPricing: { path: ['RETAIL', 'price'], gte: filters.priceMin } },
              { multiTierPricing: { path: ['WHOLESALE', 'price'], gte: filters.priceMin } },
              { multiTierPricing: { path: ['BULK', 'price'], gte: filters.priceMin } },
            ],
          });
        }

        if (filters.priceMax !== undefined) {
          priceConditions.push({
            OR: [
              { multiTierPricing: { path: ['RETAIL', 'price'], lte: filters.priceMax } },
              { multiTierPricing: { path: ['WHOLESALE', 'price'], lte: filters.priceMax } },
              { multiTierPricing: { path: ['BULK', 'price'], lte: filters.priceMax } },
            ],
          });
        }

        if (priceConditions.length > 0) {
          where.AND = priceConditions;
        }
      }

      // State filtering
      if (filters.state) {
        where.seller = {
          state: filters.state,
        };
      }

      // Verified sellers only
      if (filters.verifiedOnly) {
        where.seller = {
          ...where.seller,
          isVerified: true,
        };
      }

      // IEC Global filtering
      if (filters.iecGlobal) {
        where.seller = {
          ...where.seller,
          iecCode: { not: null },
        };
      }

      // Seller types filtering
      if (filters.sellerTypes && filters.sellerTypes.length > 0) {
        where.seller = {
          ...where.seller,
          companyType: { in: filters.sellerTypes as any },
        };
      }

      // Verification badges filtering
      if (filters.verificationBadges && filters.verificationBadges.length > 0) {
        const badgeConditions: any = {};
        const badges = filters.verificationBadges.map((b: string) => b.toLowerCase());
        if (badges.some((b: string) => b.includes('gst'))) {
          badgeConditions.gstNumber = { not: null };
        }
        if (badges.some((b: string) => b.includes('iec'))) {
          badgeConditions.iecCode = { not: null };
        }
        if (Object.keys(badgeConditions).length > 0) {
          where.seller = { ...where.seller, ...badgeConditions };
        }
      }
    }

    return where;
  }

  private buildOrderByClause(sortBy: ProductSortBy | undefined): any {
    switch (sortBy) {
      case ProductSortBy.PRICE_ASC:
        return { multiTierPricing: { sort: 'asc', path: '$.retail.price' } };
      case ProductSortBy.PRICE_DESC:
        return { multiTierPricing: { sort: 'desc', path: '$.retail.price' } };
      case ProductSortBy.NEWEST:
        return { createdAt: 'desc' };
      default: // relevance
        return { createdAt: 'desc' };
    }
  }

  private transformToProductDto(product: any): ProductResponseDto {
    const pricingTiers = this.extractPricingTiers(product.multiTierPricing);
    
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      image: this.extractPrimaryImage(product.images),
      sellerCompanyName: product.seller.companyName,
      sellerType: product.seller.companyType,
      isVerified: product.seller.isVerified,
      pricingTiers,
      sellerState: 'TN', // TODO: Add state field to seller model
      verificationBadges: this.getVerificationBadges(product.seller),
      createdAt: product.createdAt,
    };
  }

  private transformToProductDetailDto(product: any, relatedProducts: any[]): ProductDetailResponseDto {
    const baseDto = this.transformToProductDto(product);
    
    return {
      ...baseDto,
      sellerId: product.seller.id,
      hsnCode: product.hsnCode,
      countryOfOrigin: product.countryOfOrigin,
      availabilityStatus: product.availabilityStatus,
      categories: product.categories.map((pc: any) => pc.category.name),
      images: this.extractAllImages(product.images),
      viewCount: product.productViewTracking?.[0]?.viewCount || 0,
      relatedProducts: relatedProducts.map((rp: any) => this.transformToProductDto(rp)),
    };
  }

  private extractPricingTiers(multiTierPricing: any): any[] {
    if (!multiTierPricing || typeof multiTierPricing !== 'object') {
      return [];
    }

    return Object.entries(multiTierPricing).map(([tier, data]: [string, any]) => ({
      tier,
      price: data.price || 0,
      moq: data.moq || 1,
    }));
  }

  private extractPrimaryImage(images: any): string {
    if (!images || !Array.isArray(images) || images.length === 0) {
      return '';
    }
    return images[0];
  }

  private extractAllImages(images: any): string[] {
    if (!images || !Array.isArray(images)) {
      return [];
    }
    return images;
  }

  private getVerificationBadges(seller: any): string[] {
    const badges: string[] = [];
    
    if (seller.isVerified) {
      badges.push('Verified Seller');
    }
    
    if (seller.gstNumber) {
      badges.push('GST Verified');
    }
    
    if (seller.iecCode) {
      badges.push('IEC Global');
    }
    
    return badges;
  }

  async trackProductViews(productIds: string[]): Promise<void> {
    // Async, non-blocking — tracking must never affect response time
    Promise.allSettled(
      productIds.map(async (productId) => {
        const existing = await this.prisma.productViewTracking.findFirst({
          where: { productId },
          select: { id: true },
        });

        if (existing) {
          await this.prisma.productViewTracking.update({
            where: { id: existing.id },
            data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
          });
        } else {
          await this.prisma.productViewTracking.create({
            data: { productId, viewCount: 1, lastViewedAt: new Date() },
          });
        }
      }),
    ).catch(() => {
      // Intentional silent fail — analytics must not break main request flow
    });
  }

  /**
   * Create a new product
   */
  async createProduct(dto: any): Promise<any> {
    const product = await this.prisma.product.create({ data: dto });

    // Invalidate product caches
    await this.cacheInvalidation.invalidateProductCaches();

    return product;
  }

  /**
   * Update an existing product
   */
  async updateProduct(id: string, dto: any): Promise<any> {
    const product = await this.prisma.product.update({
      where: { id },
      data: dto,
    });

    // Invalidate product caches
    await this.cacheInvalidation.invalidateProductCaches(id);

    return product;
  }

  /**
   * Delete a product
   */
  async deleteProduct(id: string): Promise<void> {
    await this.prisma.product.delete({ where: { id } });

    // Invalidate product caches
    await this.cacheInvalidation.invalidateProductCaches(id);
  }

  async getSitemapProductIds(): Promise<string[]> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true, adminApprovalStatus: 'APPROVED' as any },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: 50000,
    });
    return products.map((p) => p.id);
  }

  async getSitemapCategoryIds(): Promise<string[]> {
    const categories = await this.prisma.category.findMany({
      select: { id: true },
    });
    return categories.map((c) => c.id);
  }
}