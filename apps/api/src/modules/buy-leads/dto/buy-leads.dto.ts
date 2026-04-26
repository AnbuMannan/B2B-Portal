import {
  IsOptional,
  IsString,
  IsIn,
  IsNumber,
  IsBoolean,
  IsArray,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BuyLeadFilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  productName?: string;

  /** 'domestic' | 'international' | specific country name */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  country?: string;

  /** Array of Indian state names — active when country is domestic */
  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  deliveryState?: string[];

  /** Time window for lead creation */
  @ApiProperty({ enum: ['today', '7d', '30d', 'all'], required: false })
  @IsOptional()
  @IsIn(['today', '7d', '30d', 'all'])
  period?: 'today' | '7d' | '30d' | 'all';

  /** Requirement type — RETAIL or WHOLESALE */
  @ApiProperty({ enum: ['RETAIL', 'WHOLESALE'], required: false })
  @IsOptional()
  @IsIn(['RETAIL', 'WHOLESALE'])
  requirementType?: 'RETAIL' | 'WHOLESALE';

  /** Minimum quantity */
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  qtyMin?: number;

  /** Maximum quantity */
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  qtyMax?: number;

  /** Show only leads posted after seller's last login */
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  newOnly?: boolean;

  /** Filter by whether this seller has already revealed the contact */
  @ApiProperty({ enum: ['all', 'viewed', 'unviewed'], required: false })
  @IsOptional()
  @IsIn(['all', 'viewed', 'unviewed'])
  revealStatus?: 'all' | 'viewed' | 'unviewed';

  /** Only show leads from GST-registered buyers */
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  buyerVerified?: boolean;

  /** Category IDs to filter by */
  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  categories?: string[];

  /** Buyer contact channel preference */
  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  contactChannel?: string[];

  /** Expiry window — leads expiring within this time */
  @ApiProperty({ enum: ['all', '3d', '7d'], required: false })
  @IsOptional()
  @IsIn(['all', '3d', '7d'])
  expiry?: 'all' | '3d' | '7d';

  /** Minimum target price */
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMin?: number;

  /** Maximum target price */
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMax?: number;

  /** Currency for price range filter */
  @ApiProperty({ enum: ['INR', 'USD'], required: false })
  @IsOptional()
  @IsIn(['INR', 'USD'])
  priceCurrency?: 'INR' | 'USD';

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class RevealedLeadsQueryDto {
  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class SubmitQuoteDto {
  @ApiProperty({ example: 15000, description: 'Quoted price in INR' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quotedPrice!: number;

  @ApiProperty({ required: false, example: '5-7 business days' })
  @IsOptional()
  @IsString()
  leadTime?: string;

  @ApiProperty({ required: false, example: 'Includes GST and delivery to buyer state' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false, description: 'Seller product ID to attach to this quote' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({ required: false, default: 7, description: 'Days until this quote expires' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(90)
  validDays?: number = 7;
}

// Keep old name as alias for backward compat with controller import
export { BuyLeadFilterDto as BuyLeadsQueryDto };
