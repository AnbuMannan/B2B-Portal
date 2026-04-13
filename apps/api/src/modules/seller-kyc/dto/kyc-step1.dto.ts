import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum CompanyTypeDto {
  PROPRIETORSHIP = 'PROPRIETORSHIP',
  PRIVATE_LIMITED = 'PRIVATE_LIMITED',
  LLP = 'LLP',
}

export enum BusinessModelDto {
  MANUFACTURER = 'MANUFACTURER',
  WHOLESALER = 'WHOLESALER',
  DISTRIBUTOR = 'DISTRIBUTOR',
  RETAILER = 'RETAILER',
}

export class KycStep1Dto {
  @ApiProperty({ example: 'Bharat Traders Pvt Ltd' })
  @IsString()
  @MinLength(3, { message: 'Company name must be at least 3 characters' })
  companyName: string;

  @ApiProperty({ enum: CompanyTypeDto })
  @IsEnum(CompanyTypeDto, { message: 'companyType must be PROPRIETORSHIP, PRIVATE_LIMITED, or LLP' })
  companyType: CompanyTypeDto;

  @ApiProperty({ example: ['TEXTILES', 'GARMENTS'], isArray: true })
  @IsArray()
  @IsString({ each: true })
  industryType: string[];

  @ApiProperty({ enum: BusinessModelDto })
  @IsEnum(BusinessModelDto)
  businessModel: BusinessModelDto;

  @ApiProperty({ example: false })
  @IsBoolean()
  hasIEC: boolean;
}
