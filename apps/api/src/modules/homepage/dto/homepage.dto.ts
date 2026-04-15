import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TrustMetricDto {
  @ApiProperty({ example: 'GST Verified Sellers' })
  @IsString()
  label!: string;

  @ApiProperty({ example: '500+' })
  @IsString()
  value!: string;

  @ApiProperty({ example: 'gst-verified' })
  @IsString()
  icon!: string;
}

export class HeroDataDto {
  @ApiProperty({ type: [TrustMetricDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrustMetricDto)
  trustMetrics!: TrustMetricDto[];
}

export class CategoryDto {
  @ApiProperty({ example: 'electronics' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'Electronics' })
  @IsString()
  name!: string;

  @ApiProperty({ example: ['Manufacturing', 'Components'] })
  @IsArray()
  industryType!: string[];

  @ApiProperty({ type: [CategoryDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryDto)
  @IsOptional()
  children?: CategoryDto[];
}

export class CategoriesDto {
  @ApiProperty({ type: [CategoryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryDto)
  categories!: CategoryDto[];
}

export class SellerBadgeDto {
  @ApiProperty({ example: 'GST_VERIFIED' })
  @IsString()
  type!: string;

  @ApiProperty({ example: 'GST Verified' })
  @IsString()
  label!: string;
}

export class FeaturedSellerDto {
  @ApiProperty({ example: 'company-123' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'TechCorp India' })
  @IsString()
  companyName!: string;

  @ApiProperty({ example: 'https://example.com/logo.png' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiProperty({ type: [SellerBadgeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SellerBadgeDto)
  badges!: SellerBadgeDto[];

  @ApiProperty({ example: 42 })
  @IsNumber()
  productCount!: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  yearsInBusiness!: number;
}

export class FeaturedSellersDto {
  @ApiProperty({ type: [FeaturedSellerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeaturedSellerDto)
  sellers!: FeaturedSellerDto[];
}

export class BuyLeadTickerItemDto {
  @ApiProperty({ example: 'Electronics Components' })
  @IsString()
  productName!: string;

  @ApiProperty({ example: '1000 units' })
  @IsString()
  quantity!: string;

  @ApiProperty({ example: 'India' })
  @IsString()
  country!: string;

  @ApiProperty({ example: '🇮🇳' })
  @IsString()
  flag!: string;
}

export class LatestBuyLeadsDto {
  @ApiProperty({ type: [BuyLeadTickerItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BuyLeadTickerItemDto)
  leads!: BuyLeadTickerItemDto[];
}