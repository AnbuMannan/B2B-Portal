import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { AdminContentService } from './admin-content.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateBannerDto,
  UpdateBannerDto,
  CreateCreditPackDto,
  UpdateCreditPackDto,
  AddKeywordDto,
  BulkAddKeywordsDto,
  UpdateNotificationTemplateDto,
} from './dto/content.dto';

@ApiTags('admin-content')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AdminRolesGuard)
export class AdminContentController {
  constructor(private readonly contentService: AdminContentService) {}

  // ── Categories ───────────────────────────────────────────────────────────────

  @Get('categories')
  @AdminRoles('SUPER_ADMIN', 'ADMIN', 'REVIEWER')
  @ApiOperation({ summary: 'Get full category tree' })
  async getCategories(@CurrentUser() user: { id: string }): Promise<ApiResponseDto<any>> {
    const result = await this.contentService.getCategories();
    return ApiResponseDto.success('Categories fetched', result);
  }

  @Post('categories')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Create a category (or subcategory)' })
  async createCategory(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.contentService.createCategory(dto, user.id);
    return ApiResponseDto.success('Category created', result);
  }

  @Patch('categories/:id')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update a category' })
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.contentService.updateCategory(id, dto, user.id);
    return ApiResponseDto.success('Category updated', result);
  }

  @Delete('categories/:id')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Delete a category (only if no products/leads)' })
  async deleteCategory(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.contentService.deleteCategory(id, user.id);
    return ApiResponseDto.success('Category deleted', result);
  }

  // ── Banners ──────────────────────────────────────────────────────────────────

  @Get('banners')
  @AdminRoles('SUPER_ADMIN', 'ADMIN', 'REVIEWER')
  @ApiOperation({ summary: 'List all homepage banners' })
  async getBanners(@CurrentUser() user: { id: string }): Promise<ApiResponseDto<any>> {
    const result = await this.contentService.getBanners();
    return ApiResponseDto.success('Banners fetched', result);
  }

  @Post('banners')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Create a new banner' })
  async createBanner(
    @Body() dto: CreateBannerDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.contentService.createBanner(dto, user.id);
    return ApiResponseDto.success('Banner created', result);
  }

  @Patch('banners/:id')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update a banner' })
  async updateBanner(
    @Param('id') id: string,
    @Body() dto: UpdateBannerDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.contentService.updateBanner(id, dto, user.id);
    return ApiResponseDto.success('Banner updated', result);
  }

  @Delete('banners/:id')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Delete a banner' })
  async deleteBanner(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.contentService.deleteBanner(id, user.id);
    return ApiResponseDto.success('Banner deleted', result);
  }

  // ── Credit Packs ──────────────────────────────────────────────────────────────

  @Get('config/credit-packs')
  @AdminRoles('SUPER_ADMIN', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'List lead credit packs' })
  async getCreditPacks(@CurrentUser() user: { id: string }): Promise<ApiResponseDto<any>> {
    const result = await this.contentService.getCreditPacks();
    return ApiResponseDto.success('Credit packs fetched', result);
  }

  @Post('config/credit-packs')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Create a new credit pack' })
  async createCreditPack(
    @Body() dto: CreateCreditPackDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.contentService.createCreditPack(dto, user.id);
    return ApiResponseDto.success('Credit pack created', result);
  }

  @Patch('config/credit-packs/:id')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update a credit pack' })
  async updateCreditPack(
    @Param('id') id: string,
    @Body() dto: UpdateCreditPackDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.contentService.updateCreditPack(id, dto, user.id);
    return ApiResponseDto.success('Credit pack updated', result);
  }

  // ── Prohibited Keywords ──────────────────────────────────────────────────────

  @Get('config/prohibited-keywords')
  @AdminRoles('SUPER_ADMIN', 'ADMIN', 'REVIEWER')
  @ApiOperation({ summary: 'List prohibited keywords (paginated)' })
  async getKeywords(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.contentService.getKeywords(+page, +limit);
    return ApiResponseDto.success('Keywords fetched', result);
  }

  @Post('config/prohibited-keywords')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Add a single prohibited keyword' })
  async addKeyword(
    @Body() dto: AddKeywordDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.contentService.addKeyword(dto, user.id);
    return ApiResponseDto.success('Keyword added', result);
  }

  @Post('config/prohibited-keywords/bulk')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Bulk-add prohibited keywords' })
  async bulkAddKeywords(
    @Body() dto: BulkAddKeywordsDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.contentService.bulkAddKeywords(dto, user.id);
    return ApiResponseDto.success(`${result.created} keywords added`, result);
  }

  @Delete('config/prohibited-keywords/:id')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Remove a prohibited keyword' })
  async deleteKeyword(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.contentService.deleteKeyword(id, user.id);
    return ApiResponseDto.success('Keyword removed', result);
  }

  // ── Notification Templates ────────────────────────────────────────────────────

  @Get('config/notification-templates')
  @AdminRoles('SUPER_ADMIN', 'ADMIN', 'REVIEWER', 'SUPPORT')
  @ApiOperation({ summary: 'List all notification templates' })
  async getTemplates(@CurrentUser() user: { id: string }): Promise<ApiResponseDto<any>> {
    const result = await this.contentService.getNotificationTemplates();
    return ApiResponseDto.success('Templates fetched', result);
  }

  @Patch('config/notification-templates/:key')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update a notification template by key' })
  async updateTemplate(
    @Param('key') key: string,
    @Body() dto: UpdateNotificationTemplateDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.contentService.updateNotificationTemplate(key, dto, user.id);
    return ApiResponseDto.success('Template updated', result);
  }
}
