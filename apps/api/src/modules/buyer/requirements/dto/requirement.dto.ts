import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Mirrors Prisma `ContactChannel` enum — duplicated to avoid @prisma/client
 * runtime dependency inside the DTO layer (same pattern as buyer-profile.dto).
 */
export enum ContactChannelDto {
  WHATSAPP = 'WHATSAPP',
  TELEGRAM = 'TELEGRAM',
  EMAIL = 'EMAIL',
}

export enum RepeatOptionDto {
  NONE = 'NONE',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum RequirementTypeDto {
  RETAIL = 'RETAIL',
  WHOLESALE = 'WHOLESALE',
}

export enum CurrencyDto {
  INR = 'INR',
  USD = 'USD',
}

export class CreateRequirementDto {
  @ApiProperty({ example: 'Cotton T-Shirts' })
  @IsString()
  @MaxLength(200)
  productName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: RequirementTypeDto })
  @IsOptional()
  @IsEnum(RequirementTypeDto)
  requirementType?: RequirementTypeDto;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @ApiPropertyOptional({ example: 'pieces' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetPriceMin?: number;

  @ApiPropertyOptional({ example: 220 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetPriceMax?: number;

  @ApiPropertyOptional({ enum: CurrencyDto, default: CurrencyDto.INR })
  @IsOptional()
  @IsEnum(CurrencyDto)
  currency?: CurrencyDto;

  @ApiPropertyOptional({ example: 'Maharashtra' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  deliveryState?: string;

  @ApiPropertyOptional({ example: 'India' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  expectedCountry?: string;

  @ApiProperty({ enum: ContactChannelDto })
  @IsEnum(ContactChannelDto)
  contactChannel!: ContactChannelDto;

  @ApiPropertyOptional({ enum: RepeatOptionDto, default: RepeatOptionDto.NONE })
  @IsOptional()
  @IsEnum(RepeatOptionDto)
  repeatOption?: RepeatOptionDto;

  @ApiPropertyOptional({ example: 'Need bulk supply for retail store.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  additionalNotes?: string;

  @ApiPropertyOptional({ description: 'Days until expiry (default 30)', example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  expiresInDays?: number;
}

export class UpdateRequirementDto {
  @IsOptional() @IsString() @MaxLength(200) productName?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsEnum(RequirementTypeDto) requirementType?: RequirementTypeDto;
  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() quantity?: number;
  @IsOptional() @IsString() @MaxLength(40) unit?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) targetPriceMin?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) targetPriceMax?: number;
  @IsOptional() @IsEnum(CurrencyDto) currency?: CurrencyDto;
  @IsOptional() @IsString() @MaxLength(80) deliveryState?: string;
  @IsOptional() @IsString() @MaxLength(80) expectedCountry?: string;
  @IsOptional() @IsEnum(ContactChannelDto) contactChannel?: ContactChannelDto;
  @IsOptional() @IsEnum(RepeatOptionDto) repeatOption?: RepeatOptionDto;
  @IsOptional() @IsString() @MaxLength(2000) additionalNotes?: string;
}
