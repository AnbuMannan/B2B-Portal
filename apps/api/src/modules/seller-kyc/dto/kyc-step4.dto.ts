import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export class KycStep4Dto {
  @ApiProperty({ example: 'Rajesh Kumar' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'Managing Director' })
  @IsString()
  designation: string;

  @ApiProperty({ required: false, description: 'URL of uploaded director photo' })
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiProperty({ example: 'ABCDE1234F', required: false, description: 'Director PAN (if different from company PAN)' })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsString()
  @IsOptional()
  @Matches(PAN_REGEX, { message: 'Invalid director PAN format' })
  directorPan?: string;

  @ApiProperty({
    example: '1234',
    description: 'UIDAI compliant: only last 4 digits of Aadhaar accepted',
  })
  @IsString()
  @Length(4, 4, { message: 'Aadhaar: only last 4 digits accepted (UIDAI guidelines)' })
  @Matches(/^\d{4}$/, { message: 'Aadhaar last 4 digits must be numeric' })
  aadhaarLastFour: string;
}
