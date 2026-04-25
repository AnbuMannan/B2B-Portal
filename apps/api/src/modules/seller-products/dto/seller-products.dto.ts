import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TierPricingDto {
  @ApiProperty({ example: 1500 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({ example: 10, description: 'Minimum order quantity' })
  @IsNumber()
  @Min(1)
  moq!: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  enabled!: boolean;
}

export class MultiTierPricingDto {
  @ApiProperty({ type: TierPricingDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => TierPricingDto)
  retail?: TierPricingDto;

  @ApiProperty({ type: TierPricingDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => TierPricingDto)
  wholesale?: TierPricingDto;

  @ApiProperty({ type: TierPricingDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => TierPricingDto)
  bulk?: TierPricingDto;
}

export class CreateSellerProductDto {
  @ApiProperty({ example: 'Stainless Steel Bolts M8x30' })
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '7318', required: false, description: 'HSN code for GST classification' })
  @IsString()
  @IsOptional()
  hsnCode?: string;

  @ApiProperty({
    example: 'PIECE',
    enum: ['PIECE', 'KG', 'LITRE', 'METRE', 'TON', 'BOX', 'BUNDLE', 'PACK'],
    required: false,
  })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiProperty({ type: MultiTierPricingDto })
  @IsObject()
  @ValidateNested()
  @Type(() => MultiTierPricingDto)
  multiTierPricing!: MultiTierPricingDto;

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  certifications?: string[];

  @ApiProperty({ example: 'India', required: false })
  @IsString()
  @IsOptional()
  countryOfOrigin?: string;

  @ApiProperty({ enum: ['IN_STOCK', 'OUT_OF_STOCK'], required: false })
  @IsEnum(['IN_STOCK', 'OUT_OF_STOCK'])
  @IsOptional()
  availabilityStatus?: 'IN_STOCK' | 'OUT_OF_STOCK';

  @ApiProperty({ type: [String], required: false, description: 'Category IDs' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categoryIds?: string[];

  @ApiProperty({ required: false, description: 'Part or model number (letters, numbers, hyphens, slashes)' })
  @IsString()
  @IsOptional()
  partModelNumber?: string;

  @ApiProperty({ required: false, description: 'Global minimum order quantity override' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  minimumOrderQuantity?: number;

  @ApiProperty({ required: false, description: 'GST/tax rate percentage (e.g. 18 for 18%)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  taxPercentage?: number;

  @ApiProperty({ type: [String], required: false, description: 'Search/meta tags' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ type: [String], required: false, description: 'Countries this product can be supplied to' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  buyersPreferredFrom?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  manufacturerName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  manufacturerCountry?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  aboutManufacturer?: string;

  @ApiProperty({ required: false, description: 'Primary country where stock is held' })
  @IsString()
  @IsOptional()
  stockedInCountry?: string;

  @ApiProperty({ required: false, description: 'Available stock quantity' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  stockedInQuantity?: number;

  @ApiProperty({ required: false, description: 'Packaging unit type e.g. Box, Strip, Unit, Bottle' })
  @IsString()
  @IsOptional()
  stockedInType?: string;

  @ApiProperty({ required: false, description: 'Maximum estimated shipping days' })
  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedShippingDays?: number;

  @ApiProperty({ required: false, description: 'If true, saves as draft (no review submission)' })
  @IsBoolean()
  @IsOptional()
  isDraft?: boolean;
}

export class UpdateSellerProductDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  hsnCode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiProperty({ type: MultiTierPricingDto, required: false })
  @IsObject()
  @ValidateNested()
  @Type(() => MultiTierPricingDto)
  @IsOptional()
  multiTierPricing?: MultiTierPricingDto;

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  certifications?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  countryOfOrigin?: string;

  @ApiProperty({ enum: ['IN_STOCK', 'OUT_OF_STOCK'], required: false })
  @IsEnum(['IN_STOCK', 'OUT_OF_STOCK'])
  @IsOptional()
  availabilityStatus?: 'IN_STOCK' | 'OUT_OF_STOCK';

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categoryIds?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  partModelNumber?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  minimumOrderQuantity?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  taxPercentage?: number;

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  buyersPreferredFrom?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  manufacturerName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  manufacturerCountry?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  aboutManufacturer?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  stockedInCountry?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  stockedInQuantity?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  stockedInType?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedShippingDays?: number;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isDraft?: boolean;
}
