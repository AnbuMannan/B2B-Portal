import {
  IsOptional,
  IsString,
  IsIn,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BuyLeadsQueryDto {
  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsString()
  country?: string;

  /** 'today' | 'last3days' | 'lastweek' | 'all' (default) */
  @IsOptional()
  @IsIn(['today', 'last3days', 'lastweek', 'all'])
  postedAfter?: 'today' | 'last3days' | 'lastweek' | 'all';

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
