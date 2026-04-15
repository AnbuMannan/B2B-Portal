import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

/** Converts empty/whitespace strings to undefined so @IsOptional() + @Matches() work correctly */
const emptyToUndefined = ({ value }: { value: any }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

// GSTIN: 2 digits + 5 uppercase + 4 digits + uppercase + alphanumeric + Z + alphanumeric
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
// PAN: 5 uppercase + 4 digits + 1 uppercase
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
// Udyam: starts with UDYAM- prefix
const UDYAM_REGEX = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
// IEC: 10 alphanumeric
const IEC_REGEX = /^[A-Z0-9]{10}$/;

export class KycStep3Dto {
  @ApiProperty({ example: '27AAPFU0939F1ZV' })
  @IsString()
  @Matches(GSTIN_REGEX, { message: 'Invalid GSTIN format (e.g. 27AAPFU0939F1ZV)' })
  gstNumber!: string;

  @ApiProperty({ example: '/uploads/kyc-docs/gst-cert-abc.pdf' })
  @IsString()
  gstCertificateUrl!: string;

  @ApiProperty({ example: 'AAPFU0939F' })
  @IsString()
  @Matches(PAN_REGEX, { message: 'Invalid PAN format (e.g. ABCDE1234F)' })
  panNumber!: string;

  @ApiProperty({ example: '/uploads/kyc-docs/pan-card-abc.jpg' })
  @IsString()
  panCardUrl!: string;

  @ApiProperty({ example: 'AB1234567C', required: false, description: 'Required if hasIEC=true' })
  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  @Matches(IEC_REGEX, { message: 'Invalid IEC format (10 alphanumeric characters)' })
  iecCode?: string;

  @ApiProperty({ required: false })
  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  iecCertificateUrl?: string;

  @ApiProperty({ example: 'UDYAM-MH-12-0001234', required: false })
  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  @Matches(UDYAM_REGEX, { message: 'Udyam number format: UDYAM-XX-00-0000000' })
  udyamNumber?: string;

  @ApiProperty({ required: false })
  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  udyamCertificateUrl?: string;

  @ApiProperty({ required: false })
  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  isoCertificateUrl?: string;

  @ApiProperty({ required: false, description: 'Required for pharma sector' })
  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  drugLicenceUrl?: string;

  @ApiProperty({ required: false, description: 'Required for food sector' })
  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  fssaiCertificateUrl?: string;
}
