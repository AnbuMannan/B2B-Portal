import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class NegotiateQuoteDto {
  @ApiProperty({ example: 180 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  counterPrice!: number;

  @ApiPropertyOptional({ example: 'Can you match this for a 500-unit order?' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
