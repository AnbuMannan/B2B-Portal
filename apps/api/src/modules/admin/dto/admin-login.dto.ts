import { IsEmail, IsString, IsNotEmpty, IsOptional, Length, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@b2bportal.in' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'SecureAdminPass@2025' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: '123456', required: false, description: 'TOTP code — required for ADMIN and SUPER_ADMIN roles' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;
}
