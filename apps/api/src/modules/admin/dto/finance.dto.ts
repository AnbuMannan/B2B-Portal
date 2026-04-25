import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ProcessRefundDto {
  @ApiProperty({ example: 'pay_abc123xyz', description: 'Razorpay payment ID to refund' })
  @IsString()
  @IsNotEmpty()
  razorpayPaymentId!: string;

  @ApiPropertyOptional({ example: 1770, description: 'Amount in paise; omit for full refund' })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Type(() => Number)
  amountPaise?: number;

  @ApiProperty({ example: 'Duplicate payment by seller' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class TransactionFilterDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 20;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sellerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() to?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}

export class GstrExportDto {
  @ApiPropertyOptional({ example: '2026-04', description: 'YYYY-MM for monthly, YYYY-Q1 for quarterly' })
  @IsOptional()
  @IsString()
  period?: string;
}
