import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { SellerAccountService } from './seller-account.service';
import {
  ChangePasswordDto,
  DeactivateAccountDto,
  UpdateSellerProfileDto,
  UpdateSellerSettingsDto,
} from './dto/seller-account.dto';

@ApiTags('seller-account')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Roles('SELLER')
@Controller('seller')
export class SellerAccountController {
  constructor(private readonly accountService: SellerAccountService) {}

  // ─── Profile ──────────────────────────────────────────────────────────────

  /**
   * GET /api/seller/profile
   * Returns the full authenticated seller profile including KYC docs and status.
   */
  @Get('profile')
  @ApiOperation({ summary: 'Get own full seller profile (KYC fields, documents, badges)' })
  @ApiResponse({ status: 200, description: 'Profile data' })
  async getProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.accountService.getMyProfile(user.id);
    return ApiResponseDto.success('Profile retrieved', data);
  }

  /**
   * PATCH /api/seller/profile
   * Updates allowed fields. If a re-KYC field is passed, returns { requiresReKYC: true }.
   */
  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update seller profile (name, address, city, state, phone)' })
  @ApiResponse({ status: 200, description: 'Updated or requiresReKYC flag' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSellerProfileDto,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.accountService.updateProfile(user.id, dto);
    if ('requiresReKYC' in result && result.requiresReKYC) {
      return ApiResponseDto.success(
        'Changing these fields requires re-verification. Please contact support.',
        result,
      );
    }
    return ApiResponseDto.success('Profile updated successfully', result);
  }

  // ─── Settings ─────────────────────────────────────────────────────────────

  /**
   * GET /api/seller/settings
   * Returns notification + event preferences.
   */
  @Get('settings')
  @ApiOperation({ summary: 'Get seller notification and event preferences' })
  @ApiResponse({ status: 200, description: 'Settings data' })
  async getSettings(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.accountService.getSettings(user.id);
    return ApiResponseDto.success('Settings retrieved', data);
  }

  /**
   * PATCH /api/seller/settings
   * Updates notification channel and per-event preferences.
   */
  @Patch('settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update seller notification and event preferences' })
  @ApiResponse({ status: 200, description: 'Updated' })
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSellerSettingsDto,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.accountService.updateSettings(user.id, dto);
    return ApiResponseDto.success('Settings updated', result);
  }

  // ─── Account Security ─────────────────────────────────────────────────────

  /**
   * POST /api/seller/account/change-password
   * Validates current password, sets new hash, revokes all refresh tokens.
   */
  @Post('account/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change seller account password' })
  @ApiResponse({ status: 200, description: 'Password changed; all sessions revoked' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.accountService.changePassword(user.id, dto);
    return ApiResponseDto.success('Password changed. Please log in again.', result);
  }

  /**
   * POST /api/seller/account/deactivate
   * Soft-deletes the account after password confirmation; revokes all sessions.
   */
  @Post('account/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate (soft-delete) seller account' })
  @ApiResponse({ status: 200, description: 'Account deactivated' })
  @ApiResponse({ status: 401, description: 'Password incorrect' })
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeactivateAccountDto,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.accountService.deactivateAccount(user.id, dto);
    return ApiResponseDto.success('Account deactivated successfully', result);
  }
}
