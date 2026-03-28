import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class SellerCatalogueItemDto {
  id: string;
  name: string;
  images: any;
  multiTierPricing: any;
  categoryName: string;
}

export class SellerProfileDto {
  id: string;
  companyName: string;
  companyType: string;
  city: string | null;
  state: string | null;
  companyInitials: string;
  badges: string[];
  yearsInBusiness: number;
  productCount: number;
  totalProductViews: number;
  industryTypes: string[];
  cataloguePreview: SellerCatalogueItemDto[];
}

export class SellerListItemDto {
  id: string;
  companyName: string;
  city: string | null;
  state: string | null;
  companyInitials: string;
  badges: string[];
  productCount: number;
  yearsInBusiness: number;
}

export class SellerProductsQueryDto {
  @ApiProperty({ example: 1, required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ example: 12, required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 12;

  @ApiProperty({ example: 'newest', required: false })
  @IsString()
  @IsOptional()
  sortBy?: string = 'newest';
}

export class SellerListQueryDto {
  @ApiProperty({ example: 1, required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ example: 20, required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiProperty({ example: 'Farms', required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value || undefined)
  search?: string;

  @ApiProperty({ example: 'Tamil Nadu', required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value || undefined)
  state?: string;
}
