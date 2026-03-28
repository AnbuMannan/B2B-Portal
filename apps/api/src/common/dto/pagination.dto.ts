import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class PaginationParamsDto {
  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ example: 20, required: false, default: 20, maximum: 100 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 5 })
  pages: number;

  @ApiProperty({ example: 20 })
  offset: number;

  constructor(page: number, limit: number, total: number) {
    this.page = page;
    this.limit = limit;
    this.total = total;
    this.pages = Math.ceil(total / limit);
    this.offset = (page - 1) * limit;
  }
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ type: [Object] })
  data: T[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;

  constructor(data: T[], pagination: PaginationMetaDto) {
    this.data = data;
    this.pagination = pagination;
  }
}