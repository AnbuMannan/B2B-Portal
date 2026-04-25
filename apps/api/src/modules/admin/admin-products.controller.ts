import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { AdminProductsService } from './admin-products.service';
import { RejectProductDto, BulkApproveDto } from './dto/product-review.dto';

@ApiTags('admin-products')
@ApiBearerAuth()
@Controller('admin/products')
@UseGuards(AdminRolesGuard)
export class AdminProductsController {
  constructor(private readonly productsService: AdminProductsService) {}

  @Get('queue')
  @AdminRoles('ADMIN', 'REVIEWER')
  @ApiOperation({ summary: 'Pending product approval queue' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getQueue(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.productsService.getQueue(+page, +limit);
    return ApiResponseDto.success('Product queue fetched', result);
  }

  @Get('flagged')
  @AdminRoles('ADMIN', 'REVIEWER')
  @ApiOperation({ summary: 'Products flagged by keyword pre-screening' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getFlagged(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.productsService.getFlagged(+page, +limit);
    return ApiResponseDto.success('Flagged products fetched', result);
  }

  @Get('keywords')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Get prohibited keywords list' })
  async getKeywords(): Promise<ApiResponseDto<any>> {
    const keywords = await this.productsService.getProhibitedKeywords();
    return ApiResponseDto.success('Prohibited keywords fetched', { keywords });
  }

  @Post('keywords')
  @AdminRoles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update prohibited keywords list (SUPER_ADMIN only)' })
  async updateKeywords(
    @Body() body: { keywords: string[] },
  ): Promise<ApiResponseDto<any>> {
    const keywords = await this.productsService.updateProhibitedKeywords(body.keywords);
    return ApiResponseDto.success('Prohibited keywords updated', { keywords });
  }

  @Post('bulk-approve')
  @AdminRoles('ADMIN')
  @ApiOperation({ summary: 'Bulk approve products (ADMIN only)' })
  async bulkApprove(
    @Body() dto: BulkApproveDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.productsService.bulkApprove(dto, user.id);
    return ApiResponseDto.success(`${result.approved} products approved`, result);
  }

  @Post(':id/approve')
  @AdminRoles('ADMIN', 'REVIEWER')
  @ApiOperation({ summary: 'Approve a product listing' })
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.productsService.approve(id, user.id);
    return ApiResponseDto.success('Product approved', result);
  }

  @Post(':id/reject')
  @AdminRoles('ADMIN', 'REVIEWER')
  @ApiOperation({ summary: 'Reject a product listing with reason' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectProductDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.productsService.reject(id, user.id, dto);
    return ApiResponseDto.success('Product rejected', result);
  }
}
