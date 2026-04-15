import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsArray,
  IsNumber,
  IsEnum,
  Min,
  Max,
  IsNotEmpty,
  MinLength,
} from 'class-validator';

export enum SearchSortBy {
  RELEVANCE = 'RELEVANCE',
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  NEWEST = 'NEWEST',
}

export class SearchFiltersDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  priceMin?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  priceMax?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  states?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sellerTypes?: string[];

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  verifiedOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  iecGlobal?: boolean;

  @IsOptional()
  @IsString()
  hsnCode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsEnum(SearchSortBy)
  sortBy?: SearchSortBy;
}

export class SearchRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  q!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  filters?: SearchFiltersDto;
}

export class AutocompleteQueryDto {
  @IsString()
  @IsNotEmpty()
  q!: string;
}

export class IndexProductDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;
}

// ─── Response shapes ───────────────────────────────────────────────────────────

export interface AutocompleteSuggestion {
  text: string;
  type: 'product' | 'seller';
}

export interface AutocompleteResponseDto {
  products: AutocompleteSuggestion[];
  sellers: AutocompleteSuggestion[];
}

export interface PriceRangeAgg {
  key: string;
  from?: number;
  to?: number;
  docCount: number;
}

export interface AggregationsDto {
  states: Array<{ key: string; docCount: number }>;
  companyTypes: Array<{ key: string; docCount: number }>;
  priceRanges: PriceRangeAgg[];
  categories: Array<{ key: string; docCount: number }>;
}

export interface SearchProductDto {
  id: string;
  name: string;
  description?: string;
  primaryImage?: string;
  sellerCompanyName: string;
  sellerState?: string;
  sellerCity?: string;
  companyType?: string;
  isVerified: boolean;
  hasIEC: boolean;
  priceRetail?: number;
  priceWholesale?: number;
  priceBulk?: number;
  moqRetail?: number;
  verificationBadges: string[];
  categoryNames: string[];
  hsnCode?: string;
  availabilityStatus?: string;
  createdAt: string;
  highlight?: { name?: string[]; description?: string[] };
}

export interface SearchResponseDto {
  products: SearchProductDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  aggregations: AggregationsDto;
  trendingProducts: SearchProductDto[];
}
