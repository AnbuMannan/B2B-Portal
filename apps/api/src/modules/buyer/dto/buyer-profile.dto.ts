import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * Mirrors Prisma `BusinessType` enum. Kept in this module to avoid a hard
 * runtime dependency on `@prisma/client` inside DTOs.
 */
export enum BusinessTypeDto {
  COMPANY = 'COMPANY',
  TRADER = 'TRADER',
  CONSUMER = 'CONSUMER',
}

/**
 * POST /api/buyer/profile/complete
 *
 * - `businessType` is required.
 * - For `COMPANY`, a valid GSTIN + companyName are expected — the service
 *   verifies the GSTIN against the GSTN API and sets `isVerified = true`
 *   when valid, unlocking the `GST_BUYER` badge.
 * - For `TRADER` / `CONSUMER`, GSTIN is optional.
 */
/** PATCH /api/buyer/profile */
export class UpdateBuyerProfileDto {
  @ApiPropertyOptional({ enum: BusinessTypeDto })
  @IsOptional()
  @IsEnum(BusinessTypeDto)
  businessType?: BusinessTypeDto;

  @ApiPropertyOptional({ description: '15-char GSTIN' })
  @IsOptional()
  @IsString()
  @Length(15, 15, { message: 'GSTIN must be exactly 15 characters' })
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'Invalid GSTIN format',
  })
  gstinNumber?: string;

  @ApiPropertyOptional({ example: 'Acme Traders Pvt Ltd' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;
}

export class CompleteBuyerProfileDto {
  @ApiProperty({ enum: BusinessTypeDto, example: BusinessTypeDto.COMPANY })
  @IsEnum(BusinessTypeDto, {
    message: 'businessType must be one of COMPANY, TRADER, CONSUMER',
  })
  businessType!: BusinessTypeDto;

  @ApiPropertyOptional({
    description: '15-char GSTIN — required for COMPANY type',
    example: '27AAECL1234A1Z5',
  })
  @IsOptional()
  @IsString()
  @Length(15, 15, { message: 'GSTIN must be exactly 15 characters' })
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'Invalid GSTIN format',
  })
  gstinNumber?: string;

  @ApiPropertyOptional({ example: 'Acme Traders Pvt Ltd' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;
}
