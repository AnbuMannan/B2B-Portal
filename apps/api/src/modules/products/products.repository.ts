import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '../../services/elasticsearch/elasticsearch.service';
import { PrismaService } from '../../database/database.service';
import { ProductsQueryDto, ProductSortBy } from './dto/products.dto';
import { PaginationParamsDto } from '../../common/dto/pagination.dto';

@Injectable()
export class ProductsRepository {
  private readonly indexName = 'products';

  constructor(
    private readonly prisma: PrismaService,
    private readonly elasticsearch: ElasticsearchService,
  ) {}

  async searchProducts(
    searchTerm: string,
    paginationParams: PaginationParamsDto,
    productsQuery: ProductsQueryDto
  ) {
    const page = paginationParams.page || 1;
    const limit = paginationParams.limit || 20;
    const { sortBy, filters } = productsQuery;

    try {
      // Build Elasticsearch query
      const query = this.buildElasticsearchQuery(searchTerm, filters);
      
      // Build sort configuration
      const sort = this.buildElasticsearchSort(sortBy);

      const response = await this.elasticsearch.getClient().search({
        index: this.indexName,
        body: {
          query,
          sort,
          from: (page - 1) * limit,
          size: limit,
          aggs: {
            // Add aggregations for faceted search
            categories: {
              terms: { field: 'categories.keyword' }
            },
            seller_types: {
              terms: { field: 'sellerType.keyword' }
            },
            price_ranges: {
              range: {
                field: 'minPrice',
                ranges: [
                  { to: 1000 },
                  { from: 1000, to: 5000 },
                  { from: 5000, to: 10000 },
                  { from: 10000 }
                ]
              }
            }
          }
        }
      });

      const total = response.hits.total as { value: number };
      const products = response.hits.hits.map((hit: any) => ({
        ...hit._source,
        score: hit._score,
      }));

      return {
        products,
        total: total.value,
        aggregations: response.aggregations,
      };
    } catch (error) {
      // Fallback to database search if Elasticsearch fails
      console.warn('Elasticsearch search failed, falling back to database:', error.message);
      return this.searchProductsInDatabase(searchTerm, paginationParams, productsQuery);
    }
  }

  async searchProductsInDatabase(
    searchTerm: string,
    paginationParams: PaginationParamsDto,
    productsQuery: ProductsQueryDto
  ) {
    const page = paginationParams.page || 1;
    const limit = paginationParams.limit || 20;
    const { sortBy, filters } = productsQuery;

    const whereClause = this.buildDatabaseWhereClause(searchTerm, filters);
    const orderByClause = this.buildDatabaseOrderByClause(sortBy);

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
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
      }),
      this.prisma.product.count({ where: whereClause }),
    ]);

    return {
      products,
      total,
      aggregations: null, // No aggregations in database fallback
    };
  }

  async indexProduct(product: any) {
    try {
      await this.elasticsearch.getClient().index({
        index: this.indexName,
        id: product.id,
        body: {
          id: product.id,
          name: product.name,
          description: product.description,
          hsnCode: product.hsnCode,
          categories: product.categories?.map((pc: any) => pc.category.name) || [],
          sellerId: product.sellerId,
          sellerCompanyName: product.seller?.companyName,
          sellerType: product.seller?.companyType,
          isVerified: product.seller?.isVerified,
          pricingTiers: product.multiTierPricing,
          minPrice: this.calculateMinPrice(product.multiTierPricing),
          maxPrice: this.calculateMaxPrice(product.multiTierPricing),
          availabilityStatus: product.availabilityStatus,
          countryOfOrigin: product.countryOfOrigin,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        },
        refresh: true, // Wait for the document to become searchable
      });
    } catch (error) {
      console.error('Failed to index product in Elasticsearch:', error);
      throw error;
    }
  }

  async deleteProductFromIndex(productId: string) {
    try {
      await this.elasticsearch.getClient().delete({
        index: this.indexName,
        id: productId,
        refresh: true,
      });
    } catch (error) {
      // Ignore if product doesn't exist in index
      const errorAny = error as any;
      if (errorAny.meta?.statusCode !== 404) {
        console.error('Failed to delete product from Elasticsearch index:', error);
      }
    }
  }

  async updateProductInIndex(productId: string, updates: any) {
    try {
      await this.elasticsearch.getClient().update({
        index: this.indexName,
        id: productId,
        body: {
          doc: updates,
        },
        refresh: true,
      });
    } catch (error) {
      console.error('Failed to update product in Elasticsearch index:', error);
      // Re-index the product if update fails
      const fullProduct = await this.prisma.product.findUnique({
        where: { id: productId },
        include: {
          seller: {
            select: {
              companyName: true,
              companyType: true,
              isVerified: true,
            },
          },
          categories: {
            include: {
              category: true,
            },
          },
        },
      });

      if (fullProduct) {
        await this.indexProduct(fullProduct);
      }
    }
  }

  async createIndexIfNotExists() {
    try {
      const indexExists = await this.elasticsearch.getClient().indices.exists({
        index: this.indexName,
      });

      if (!indexExists) {
        await this.elasticsearch.getClient().indices.create({
          index: this.indexName,
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                name: { type: 'text', analyzer: 'standard' },
                description: { type: 'text', analyzer: 'standard' },
                hsnCode: { type: 'keyword' },
                categories: { type: 'keyword' },
                sellerId: { type: 'keyword' },
                sellerCompanyName: { type: 'text' },
                sellerType: { type: 'keyword' },
                isVerified: { type: 'boolean' },
                pricingTiers: { type: 'object', enabled: false },
                minPrice: { type: 'float' },
                maxPrice: { type: 'float' },
                availabilityStatus: { type: 'keyword' },
                countryOfOrigin: { type: 'keyword' },
                createdAt: { type: 'date' },
                updatedAt: { type: 'date' },
              },
            },
            settings: {
              analysis: {
                analyzer: {
                  standard: {
                    type: 'standard',
                  },
                },
              },
            },
          },
        });

        console.log('Elasticsearch index created:', this.indexName);
      }
    } catch (error) {
      console.error('Failed to create Elasticsearch index:', error);
    }
  }

  private buildElasticsearchQuery(searchTerm: string, filters?: any) {
    const must: any[] = [];
    const should: any[] = [];
    const filter: any[] = [];

    // Full-text search
    if (searchTerm) {
      must.push({
        multi_match: {
          query: searchTerm,
          fields: ['name^3', 'description^2', 'sellerCompanyName', 'categories'],
          fuzziness: 'AUTO',
        },
      });
    }

    // Filter by price range
    if (filters?.priceMin !== undefined || filters?.priceMax !== undefined) {
      filter.push({
        range: {
          minPrice: {
            ...(filters.priceMin && { gte: filters.priceMin }),
            ...(filters.priceMax && { lte: filters.priceMax }),
          },
        },
      });
    }

    // Filter by seller type
    if (filters?.sellerTypes && filters.sellerTypes.length > 0) {
      filter.push({
        terms: {
          sellerType: filters.sellerTypes,
        },
      });
    }

    // Filter by verified sellers only
    if (filters?.verifiedOnly) {
      filter.push({
        term: {
          isVerified: true,
        },
      });
    }

    // Filter by IEC Global
    if (filters?.iecGlobal) {
      // This would require additional field in Elasticsearch index
      // For now, we'll handle this in application logic
    }

    return {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        should,
        filter,
      },
    };
  }

  private buildElasticsearchSort(sortBy: ProductSortBy | undefined): any[] {
    switch (sortBy) {
      case ProductSortBy.PRICE_ASC:
        return [{ minPrice: { order: 'asc' } }];
      case ProductSortBy.PRICE_DESC:
        return [{ minPrice: { order: 'desc' } }];
      case ProductSortBy.NEWEST:
        return [{ createdAt: { order: 'desc' } }];
      default: // relevance
        return [{ _score: { order: 'desc' } }];
    }
  }

  private buildDatabaseWhereClause(searchTerm: string, filters?: any) {
    const where: any = {
      isActive: true,
      adminApprovalStatus: 'APPROVED',
    };

    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { seller: { companyName: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    // Add other filters similar to the service implementation
    if (filters) {
      // Price filtering
      if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
        where.multiTierPricing = {
          path: ['$.*.price'],
          array_contains: {
            $elemMatch: {
              price: {
                ...(filters.priceMin && { gte: filters.priceMin }),
                ...(filters.priceMax && { lte: filters.priceMax }),
              },
            },
          },
        };
      }

      // Other filters...
    }

    return where;
  }

  private buildDatabaseOrderByClause(sortBy: ProductSortBy | undefined): any {
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

  private calculateMinPrice(pricingTiers: any): number {
    if (!pricingTiers || typeof pricingTiers !== 'object') {
      return 0;
    }

    const prices = Object.values(pricingTiers)
      .filter((tier: any) => tier && typeof tier === 'object' && tier.price !== undefined)
      .map((tier: any) => tier.price);

    return prices.length > 0 ? Math.min(...prices) : 0;
  }

  private calculateMaxPrice(pricingTiers: any): number {
    if (!pricingTiers || typeof pricingTiers !== 'object') {
      return 0;
    }

    const prices = Object.values(pricingTiers)
      .filter((tier: any) => tier && typeof tier === 'object' && tier.price !== undefined)
      .map((tier: any) => tier.price);

    return prices.length > 0 ? Math.max(...prices) : 0;
  }
}
