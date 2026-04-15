import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum ProductSortBy {
  RELEVANCE = 'relevance',
  PRICE_ASC = 'price-asc',
  PRICE_DESC = 'price-desc',
  NEWEST = 'newest'
}

export enum SellerType {
  MANUFACTURER = 'Manufacturer',
  WHOLESALER = 'Wholesaler',
  DISTRIBUTOR = 'Distributor',
  RETAILER = 'Retailer'
}

export class ProductFiltersDto {
  @ApiProperty({ example: 1000, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  priceMin?: number;

  @ApiProperty({ example: 50000, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  priceMax?: number;

  @ApiProperty({ example: 'TN', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  verifiedOnly?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  iecGlobal?: boolean;

  @ApiProperty({ example: 'retail', required: false })
  @IsString()
  @IsOptional()
  pricingTier?: string;

  @ApiProperty({ enum: SellerType, isArray: true, required: false })
  @IsArray()
  @IsOptional()
  @IsEnum(SellerType, { each: true })
  sellerTypes?: SellerType[];

  @ApiProperty({ example: ['GST Verified', 'MSME'], required: false })
  @IsArray()
  @IsOptional()
  verificationBadges?: string[];
}

export class ProductsQueryDto {
  @ApiProperty({ enum: ProductSortBy, required: false, default: ProductSortBy.RELEVANCE })
  @IsEnum(ProductSortBy)
  @IsOptional()
  sortBy?: ProductSortBy = ProductSortBy.RELEVANCE;

  @ApiProperty({ type: ProductFiltersDto, required: false })
  @IsOptional()
  filters?: ProductFiltersDto;
}

export class PricingTierDto {
  @ApiProperty({ example: 'retail' })
  tier!: string;

  @ApiProperty({ example: 1000 })
  price!: number;

  @ApiProperty({ example: 10 })
  moq!: number;
}

export class ProductResponseDto {
  @ApiProperty({ example: 'clxyz123' })
  id!: string;

  @ApiProperty({ example: 'iPhone 15 Pro Max' })
  name!: string;

  @ApiProperty({ example: 'Latest iPhone with advanced camera features' })
  description?: string;

  @ApiProperty({ example: 'https://example.com/image.jpg' })
  image!: string;

  @ApiProperty({ example: 'Apple Inc.' })
  sellerCompanyName!: string;

  @ApiProperty({ example: 'Manufacturer' })
  sellerType!: string;

  @ApiProperty({ example: true })
  isVerified!: boolean;

  @ApiProperty({ type: [PricingTierDto] })
  pricingTiers!: PricingTierDto[];

  @ApiProperty({ example: 'TN' })
  sellerState!: string;

  @ApiProperty({ example: ['GST Verified', 'IEC Global'] })
  verificationBadges!: string[];

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt!: Date;
}

export enum ContactChannel {
  WHATSAPP = 'WHATSAPP',
  TELEGRAM = 'TELEGRAM',
  EMAIL = 'EMAIL',
}

export class CreateEnquiryDto {
  @ApiProperty({ example: 50, description: 'Quantity required' })
  @IsNumber()
  @Min(1, { message: 'Quantity must be at least 1' })
  @Type(() => Number)
  quantity!: number;

  @ApiProperty({ example: 'pieces', description: 'Unit of measure' })
  @IsString()
  unit!: string;

  @ApiProperty({ example: 1000, required: false, description: 'Minimum target price in INR' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  targetPriceMin?: number;

  @ApiProperty({ example: 5000, required: false, description: 'Maximum target price in INR' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  targetPriceMax?: number;

  @ApiProperty({ enum: ContactChannel, example: ContactChannel.WHATSAPP })
  @IsEnum(ContactChannel)
  contactChannel!: ContactChannel;
}

/**
 * Flat query DTO for GET /categories/:id/products
 * Merges pagination + sort + all filters into a single object to avoid
 * the `forbidNonWhitelisted` 400 error that occurs when two @Query() decorators
 * each receive the full query string.
 */
export class CategoryProductsQueryDto {
  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ example: 20, required: false, default: 20 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiProperty({ enum: ProductSortBy, required: false, default: ProductSortBy.RELEVANCE })
  @IsEnum(ProductSortBy)
  @IsOptional()
  sortBy?: ProductSortBy = ProductSortBy.RELEVANCE;

  @ApiProperty({ example: 1000, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  priceMin?: number;

  @ApiProperty({ example: 50000, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  priceMax?: number;

  @ApiProperty({ example: 'TN', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  verifiedOnly?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  iecGlobal?: boolean;

  @ApiProperty({ enum: SellerType, isArray: true, required: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    return Array.isArray(value) ? value : [value];
  })
  @IsArray()
  @IsString({ each: true })
  sellerTypes?: string[];

  @ApiProperty({ example: ['GST Verified', 'MSME'], required: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    return Array.isArray(value) ? value : [value];
  })
  @IsArray()
  @IsString({ each: true })
  verificationBadges?: string[];
}

export class ProductDetailResponseDto extends ProductResponseDto {
  @ApiProperty({ example: 'clxyz123' })
  sellerId!: string;

  @ApiProperty({ example: '1234567890' })
  hsnCode?: string;

  @ApiProperty({ example: 'India' })
  countryOfOrigin?: string;

  @ApiProperty({ example: 'IN_STOCK' })
  availabilityStatus!: string;

  @ApiProperty({ type: [String], example: ['Electronics', 'Mobile Phones'] })
  categories!: string[];

  @ApiProperty({ type: [String], example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'] })
  images!: string[];

  @ApiProperty({ example: 150 })
  viewCount!: number;

  @ApiProperty({ type: [ProductResponseDto] })
  relatedProducts!: ProductResponseDto[];
}