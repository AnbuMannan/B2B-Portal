import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export enum RegisterRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
}

export class RegisterDto {
  @ApiProperty({ example: 'buyer@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;

  @ApiProperty({ example: '9876543210', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Please provide a valid 10-digit Indian mobile number',
  })
  phoneNumber?: string;

  @ApiProperty({ enum: RegisterRole, example: RegisterRole.BUYER, required: false })
  @IsEnum(RegisterRole)
  @IsOptional()
  role?: 'BUYER' | 'SELLER';
}
