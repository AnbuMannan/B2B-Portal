import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SellersService } from './sellers.service';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import {
  SellerProductsQueryDto,
  SellerListQueryDto,
} from './dto/seller-profile.dto';

@ApiTags('sellers')
@Controller('sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get('sitemap-ids')
  @ApiOperation({ summary: 'Return all approved seller IDs for sitemap generation' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  async getSitemapSellerIds(): Promise<ApiResponseDto<{ ids: string[] }>> {
    const ids = await this.sellersService.getSitemapSellerIds();
    return ApiResponseDto.success('Sitemap seller IDs retrieved', { ids });
  }

  @Get()
  @ApiOperation({ summary: 'List verified sellers directory' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  async getSellersList(
    @Query() query: SellerListQueryDto,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.sellersService.getSellersList(query);
    return ApiResponseDto.success('Sellers retrieved successfully', data);
  }

  @Get(':sellerId/profile')
  @ApiOperation({ summary: 'Get public seller profile' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @ApiResponse({ status: 404, description: 'Seller not found' })
  async getSellerProfile(
    @Param('sellerId') sellerId: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.sellersService.getSellerProfile(sellerId);
    return ApiResponseDto.success('Seller profile retrieved successfully', data);
  }

  @Get(':sellerId/products')
  @ApiOperation({ summary: 'Get paginated product listing for a seller' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @ApiResponse({ status: 404, description: 'Seller not found' })
  async getSellerProducts(
    @Param('sellerId') sellerId: string,
    @Query() query: SellerProductsQueryDto,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.sellersService.getSellerProducts(sellerId, query);
    return ApiResponseDto.success('Seller products retrieved successfully', data);
  }
}
