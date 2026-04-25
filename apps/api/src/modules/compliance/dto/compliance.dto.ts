import { IsString, IsNotEmpty, IsIn, IsOptional, IsEmail, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordConsentDto {
  @ApiProperty({ enum: ['ESSENTIAL', 'MARKETING', 'ANALYTICS', 'DATA_SHARING'] })
  @IsString()
  @IsIn(['ESSENTIAL', 'MARKETING', 'ANALYTICS', 'DATA_SHARING'])
  consentType!: string;

  @ApiProperty({ example: 'v2024.1', description: 'Policy version shown to user at time of consent' })
  @IsString()
  @IsNotEmpty()
  version!: string;
}

export class WithdrawConsentDto {
  @ApiProperty({ enum: ['MARKETING', 'ANALYTICS', 'DATA_SHARING'] })
  @IsString()
  @IsIn(['MARKETING', 'ANALYTICS', 'DATA_SHARING'])
  consentType!: string;
}

export class GrievanceDto {
  @ApiProperty({ example: 'Rahul Sharma' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 'rahul@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Unauthorized use of my personal data' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  subject!: string;

  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  description!: string;

  @ApiProperty({ enum: ['DATA_BREACH', 'CONSENT', 'ERASURE', 'CORRECTION', 'PORTABILITY', 'OTHER'] })
  @IsString()
  @IsIn(['DATA_BREACH', 'CONSENT', 'ERASURE', 'CORRECTION', 'PORTABILITY', 'OTHER'])
  category!: string;
}

export class DeleteAccountDto {
  @ApiProperty({ description: 'User must type DELETE to confirm' })
  @IsString()
  @IsIn(['DELETE'])
  confirmation!: string;

  @ApiPropertyOptional({ description: 'Optional reason for deletion' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
