import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiConsumes } from '@nestjs/swagger';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SellerProductsService } from './seller-products.service';
import { CreateSellerProductDto, UpdateSellerProductDto } from './dto/seller-products.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('seller-products')
@ApiBearerAuth()
@Controller('seller/products')
export class SellerProductsController {
  constructor(private readonly sellerProductsService: SellerProductsService) {}

  @Post()
  @Roles('SELLER')
  @ApiOperation({ summary: 'Create a new product listing (sets adminApprovalStatus = PENDING)' })
  @ApiResponse({ status: 201, description: 'Product created' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSellerProductDto,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.sellerProductsService.create(user.id, dto);
    return ApiResponseDto.success('Product created successfully. Pending admin review.', data);
  }

  @Get()
  @Roles('SELLER')
  @ApiOperation({ summary: 'List own products with optional filters' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('isActive') isActiveStr?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
  ): Promise<ApiResponseDto<any>> {
    const isActive =
      isActiveStr === 'true' ? true : isActiveStr === 'false' ? false : undefined;
    const data = await this.sellerProductsService.findAll(user.id, {
      status,
      isActive,
      page,
      limit,
    });
    return ApiResponseDto.success('Products retrieved', data);
  }

  @Get('categories')
  @Roles('SELLER')
  @ApiOperation({ summary: 'Get all product categories for the dropdown' })
  async getCategories(): Promise<ApiResponseDto<any>> {
    const data = await this.sellerProductsService.getCategories();
    return ApiResponseDto.success('Categories retrieved', data);
  }

  @Get(':id')
  @Roles('SELLER')
  @ApiOperation({ summary: 'Get a single product by ID (must belong to the seller)' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.sellerProductsService.findOne(user.id, id);
    return ApiResponseDto.success('Product retrieved', data);
  }

  @Patch(':id')
  @Roles('SELLER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Update a product. Changing critical fields (name, HSN, pricing, images) resets approval to PENDING.',
  })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSellerProductDto,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.sellerProductsService.update(user.id, id, dto);
    return ApiResponseDto.success('Product updated', data);
  }

  @Delete(':id')
  @Roles('SELLER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a product (soft delete — sets isActive=false)' })
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.sellerProductsService.deactivate(user.id, id);
    return ApiResponseDto.success('Product deactivated', data);
  }

  @Patch(':id/reactivate')
  @Roles('SELLER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a previously deactivated product (sets isActive=true)' })
  async reactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.sellerProductsService.reactivate(user.id, id);
    return ApiResponseDto.success('Product reactivated', data);
  }

  @Post('import-csv')
  @Roles('SELLER')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Bulk import products from CSV (max 2 MB, 500 rows)' })
  @ApiResponse({ status: 200, description: 'Import summary with counts and any row errors' })
  async importCsv(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiResponseDto<any>> {
    if (!file) throw new BadRequestException('CSV file is required (field name: file)');
    if (!file.originalname.endsWith('.csv') && file.mimetype !== 'text/csv') {
      throw new BadRequestException('File must be a CSV (.csv)');
    }
    const data = await this.sellerProductsService.importCsv(user.id, file.buffer);
    return ApiResponseDto.success(`Imported ${data.imported} product(s)`, data);
  }
}
