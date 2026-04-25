import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsUrl,
  IsDateString,
  IsArray,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ── Category DTOs ────────────────────────────────────────────────────────────

export class CreateCategoryDto {
  @ApiProperty({ example: 'Industrial Machinery' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industryType?: string[];
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industryType?: string[];
}

// ── Banner DTOs ───────────────────────────────────────────────────────────────

export class CreateBannerDto {
  @ApiProperty({ example: 'Summer Sale — Up to 40% off' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'https://cdn.example.com/banners/summer.webp' })
  @IsString()
  @IsNotEmpty()
  imageUrl!: string;

  @ApiPropertyOptional({ example: '/category/machinery' })
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateBannerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// ── Credit Pack DTOs ──────────────────────────────────────────────────────────

export class UpdateCreditPackDto {
  @ApiPropertyOptional({ example: 'Basic Pack' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  credits?: number;

  @ApiPropertyOptional({ example: 599 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  priceInr?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;
}

export class CreateCreditPackDto {
  @ApiProperty({ example: 'Enterprise' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 500 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  credits!: number;

  @ApiProperty({ example: 6999 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  priceInr!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;
}

// ── Prohibited Keywords DTOs ─────────────────────────────────────────────────

export class AddKeywordDto {
  @ApiProperty({ example: 'fake invoice' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  keyword!: string;
}

export class BulkAddKeywordsDto {
  @ApiProperty({ type: [String], example: ['counterfeit', 'pirated', 'fake invoice'] })
  @IsArray()
  @IsString({ each: true })
  keywords!: string[];
}

// ── Notification Template DTOs ────────────────────────────────────────────────

export class UpdateNotificationTemplateDto {
  @ApiPropertyOptional({ example: 'KYC Approved' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  bodyEn?: string;

  @ApiPropertyOptional({ example: 'KYC स्वीकृत' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleHi?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  bodyHi?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
