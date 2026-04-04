import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ProductsQueryDto, CategoryProductsQueryDto, ProductResponseDto, ProductDetailResponseDto, CreateEnquiryDto } from './dto/products.dto';
import { PaginationParamsDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { FeatureFlag } from '../../common/decorators/feature-flag.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('products')
@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('categories/:categoryId/products')
  @ApiOperation({ summary: 'List products in a specific category with pagination and filtering' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getCategoryProducts(
    @Param('categoryId') categoryId: string,
    @Query() query: CategoryProductsQueryDto,
  ): Promise<ApiResponseDto<PaginatedResponseDto<ProductResponseDto>>> {
    const result = await this.productsService.getCategoryProducts(categoryId, query);
    return ApiResponseDto.success('Products retrieved successfully', result);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get category tree with product counts per category' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  async getCategoriesWithCounts(): Promise<ApiResponseDto<any>> {
    const data = await this.productsService.getCategoriesWithProductCounts();
    return ApiResponseDto.success('Categories with product counts retrieved successfully', data);
  }

  @Get('categories/:categoryId/breadcrumb')
  @ApiOperation({ summary: 'Get breadcrumb trail for a category (root → current)' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  async getCategoryBreadcrumb(@Param('categoryId') categoryId: string): Promise<ApiResponseDto<any>> {
    const data = await this.productsService.getCategoryBreadcrumb(categoryId);
    return ApiResponseDto.success('Breadcrumb retrieved successfully', data);
  }

  @Get('categories/:categoryId')
  @ApiOperation({ summary: 'Get a single category by ID with product count' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getCategoryById(@Param('categoryId') categoryId: string): Promise<ApiResponseDto<any>> {
    const data = await this.productsService.getCategoryById(categoryId);
    return ApiResponseDto.success('Category retrieved successfully', data);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get single product detail with seller info and related products' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProductDetail(@Param('id') id: string): Promise<ApiResponseDto<ProductDetailResponseDto>> {
    const data = await this.productsService.getProductDetail(id);
    return ApiResponseDto.success('Product details retrieved successfully', data);
  }

  @Post('products/:id/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Track a product view (fire-and-forget)' })
  @ApiResponse({ status: 204, description: 'View tracked' })
  async trackView(@Param('id') id: string): Promise<void> {
    this.productsService.trackProductViews([id]).catch(() => {});
  }

  @Post('products/:id/enquiry')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiSecurity('bearer')
  @ApiOperation({ summary: 'Submit an enquiry / buy lead for a product (buyers only)' })
  @ApiResponse({ status: 201, description: 'Enquiry submitted successfully' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Buyer profile not found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async createEnquiry(
    @Param('id') productId: string,
    @Body() dto: CreateEnquiryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponseDto<null>> {
    await this.productsService.createEnquiry(productId, user.id, dto);
    return ApiResponseDto.success(
      'Your enquiry has been sent. Sellers will contact you shortly.',
      null,
    );
  }

  @Get('products/sitemap-ids')
  @ApiOperation({ summary: 'Return all approved product IDs for sitemap generation' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  async getSitemapProductIds(): Promise<ApiResponseDto<{ ids: string[] }>> {
    const ids = await this.productsService.getSitemapProductIds();
    return ApiResponseDto.success('Sitemap product IDs retrieved', { ids });
  }

  @Get('categories/sitemap-ids')
  @ApiOperation({ summary: 'Return all category IDs for sitemap generation' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  async getSitemapCategoryIds(): Promise<ApiResponseDto<{ ids: string[] }>> {
    const ids = await this.productsService.getSitemapCategoryIds();
    return ApiResponseDto.success('Sitemap category IDs retrieved', { ids });
  }

  @Get('products')
  @ApiOperation({ summary: 'Search products with filters and sorting (full-text search)' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @FeatureFlag({ name: 'MODULE_ADVANCED_FILTERS_ENABLED', fallback: { success: false, message: 'Advanced filters are disabled', data: null } })
  async searchProducts(
    @Query() paginationParams: PaginationParamsDto,
    @Query() productsQuery: ProductsQueryDto,
    @Query('search') searchTerm?: string
  ): Promise<ApiResponseDto<PaginatedResponseDto<ProductResponseDto>>> {
    const result = await this.productsService.searchProducts(
      paginationParams,
      productsQuery,
      searchTerm
    );
    return ApiResponseDto.success('Products search completed successfully', result);
  }
}
