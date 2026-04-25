import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BlockUserDto {
  @ApiProperty({ description: 'User ID to block' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: 'Multiple fake accounts detected — same phone number on 3 accounts' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UnblockUserDto {
  @ApiProperty({ description: 'User ID to restore' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiPropertyOptional({ example: 'Verified legitimate after manual review' })
  @IsOptional()
  @IsString()
  notes?: string;
}
