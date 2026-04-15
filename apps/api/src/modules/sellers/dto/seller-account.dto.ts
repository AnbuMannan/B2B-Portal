import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// ─── Updateable Profile Fields ─────────────────────────────────────────────────
// Non-updateable without re-KYC: gstNumber, panNumber, companyType
const REKYC_FIELDS = ['gstNumber', 'panNumber', 'companyType'] as const;
export type ReKycField = (typeof REKYC_FIELDS)[number];
export const RE_KYC_FIELD_SET = new Set<string>(REKYC_FIELDS);

export class UpdateSellerProfileDto {
  @ApiProperty({ example: 'Sharma Textiles Pvt Ltd', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  companyName?: string;

  @ApiProperty({ example: '12th Floor, Tower B, Cyber Hub', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  businessOfficeAddress?: string;

  @ApiProperty({ example: 'Gurugram', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @ApiProperty({ example: 'Haryana', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  state?: string;

  @ApiProperty({ example: '+919876543210', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Invalid phone number format' })
  phone?: string;

  // ─── Critical fields → triggers requiresReKYC response ─────────────────────
  @ApiProperty({ example: '22ABCDE1234F1Z5', required: false })
  @IsString()
  @IsOptional()
  gstNumber?: string;

  @ApiProperty({ example: 'ABCDE1234F', required: false })
  @IsString()
  @IsOptional()
  panNumber?: string;

  @ApiProperty({ example: 'PRIVATE_LIMITED', required: false })
  @IsString()
  @IsOptional()
  companyType?: string;
}

// ─── Notification / Settings ───────────────────────────────────────────────────

/** Per-event-type channel preferences, e.g. { NEW_LEAD: { email: true, sms: false } } */
export type EventPreferences = Record<
  string,
  { email?: boolean; sms?: boolean; whatsapp?: boolean }
>;

export class UpdateSellerSettingsDto {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  emailNotifications?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  smsNotifications?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  whatsappNotifications?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  pushNotifications?: boolean;

  @ApiProperty({
    required: false,
    example: { NEW_LEAD: { email: true, sms: false, whatsapp: true } },
  })
  @IsObject()
  @IsOptional()
  eventPreferences?: EventPreferences;
}

// ─── Password Change ───────────────────────────────────────────────────────────

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPassword123!' })
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @ApiProperty({ example: 'NewPassword456!' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

// ─── Account Deactivation ─────────────────────────────────────────────────────

export class DeactivateAccountDto {
  @ApiProperty({ example: 'CurrentPassword123!' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({ example: 'Closing my business', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
