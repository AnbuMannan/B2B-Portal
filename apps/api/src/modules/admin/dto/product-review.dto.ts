import { IsString, IsNotEmpty, MinLength, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectProductDto {
  @ApiProperty({ example: 'Product description contains prohibited content.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  reason!: string;
}

export class BulkApproveDto {
  @ApiProperty({ type: [String], example: ['clxxx1', 'clxxx2'] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  productIds!: string[];
}
