import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HomepageService } from './homepage.service';
import { HeroDataDto, CategoriesDto, FeaturedSellersDto, LatestBuyLeadsDto } from './dto/homepage.dto';
import { FeatureFlag } from '../../common/decorators/feature-flag.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('homepage')
@Controller('homepage')
export class HomepageController {
  constructor(private readonly homepageService: HomepageService) {}

  @Get('hero-data')
  @ApiOperation({ summary: 'Get homepage hero section data' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @ApiResponse({ status: 403, description: 'Feature disabled' })
  @FeatureFlag({ name: 'MODULE_HOMEPAGE_ENABLED', fallback: { success: false, message: 'Homepage module is disabled', data: null } })
  async getHeroData(): Promise<ApiResponseDto<HeroDataDto>> {
    const data = await this.homepageService.getHeroData();
    return ApiResponseDto.success('Hero data retrieved successfully', data);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get hierarchical category tree for navigation' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @ApiResponse({ status: 403, description: 'Feature disabled' })
  @FeatureFlag({ name: 'MODULE_HOMEPAGE_ENABLED', fallback: { success: false, message: 'Homepage module is disabled', data: null } })
  async getCategories(): Promise<ApiResponseDto<CategoriesDto>> {
    const data = await this.homepageService.getCategories();
    return ApiResponseDto.success('Categories retrieved successfully', data);
  }

  @Get('featured-sellers')
  @ApiOperation({ summary: 'Get featured verified sellers' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @ApiResponse({ status: 403, description: 'Feature disabled' })
  @FeatureFlag({ name: 'MODULE_HOMEPAGE_ENABLED', fallback: { success: false, message: 'Homepage module is disabled', data: null } })
  async getFeaturedSellers(): Promise<ApiResponseDto<FeaturedSellersDto>> {
    const data = await this.homepageService.getFeaturedSellers();
    return ApiResponseDto.success('Featured sellers retrieved successfully', data);
  }

  @Get('latest-buy-leads')
  @ApiOperation({ summary: 'Get latest buy leads for ticker' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @ApiResponse({ status: 403, description: 'Feature disabled' })
  @FeatureFlag({ name: 'MODULE_HOMEPAGE_ENABLED', fallback: { success: false, message: 'Homepage module is disabled', data: null } })
  async getLatestBuyLeads(): Promise<ApiResponseDto<LatestBuyLeadsDto>> {
    const data = await this.homepageService.getLatestBuyLeads();
    return ApiResponseDto.success('Latest buy leads retrieved successfully', data);
  }
}