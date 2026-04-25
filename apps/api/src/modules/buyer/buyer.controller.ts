import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { BuyerService } from './buyer.service';
import {
  CompleteBuyerProfileDto,
  UpdateBuyerProfileDto,
} from './dto/buyer-profile.dto';

@ApiTags('buyer')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Roles('BUYER')
@Controller('buyer')
export class BuyerController {
  constructor(private readonly buyerService: BuyerService) {}

  /**
   * POST /api/buyer/profile/complete
   * Completes buyer registration (after base auth signup). Validates GSTIN
   * via the GSTN API for COMPANY buyers and awards the GST_BUYER badge.
   */
  @Post('profile/complete')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Complete buyer profile (business type + optional GSTIN)' })
  @ApiResponse({ status: 200, description: 'Profile completed' })
  @ApiResponse({ status: 400, description: 'Invalid GSTIN or missing required field' })
  async completeProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompleteBuyerProfileDto,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyerService.completeProfile(user.id, dto);
    return ApiResponseDto.success('Buyer profile completed', data);
  }

  /**
   * GET /api/buyer/dashboard
   * Returns profile snapshot, KPIs, and recent leads / quotes / orders.
   */
  @Get('dashboard')
  @ApiOperation({ summary: 'Get aggregated buyer dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  @ApiResponse({ status: 404, description: 'Buyer profile not found' })
  async getDashboard(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyerService.getDashboard(user.id);
    return ApiResponseDto.success('Dashboard loaded', data);
  }

  /**
   * GET /api/buyer/saved-sellers
   * Returns sellers the buyer has bookmarked.
   */
  @Get('saved-sellers')
  @ApiOperation({ summary: 'List saved (bookmarked) sellers for the current buyer' })
  @ApiResponse({ status: 200, description: 'Saved sellers list' })
  async getSavedSellers(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyerService.getSavedSellers(user.id);
    return ApiResponseDto.success('Saved sellers retrieved', data);
  }

  /**
   * POST /api/buyer/saved-sellers/:sellerId
   * Bookmark a seller.
   */
  @Post('saved-sellers/:sellerId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save (bookmark) a seller' })
  @ApiResponse({ status: 200, description: 'Seller saved' })
  async saveSeller(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sellerId') sellerId: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyerService.saveSeller(user.id, sellerId);
    return ApiResponseDto.success('Seller saved', data);
  }

  /**
   * DELETE /api/buyer/saved-sellers/:sellerId
   * Remove a seller from the watchlist.
   */
  @Delete('saved-sellers/:sellerId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a saved seller' })
  @ApiResponse({ status: 200, description: 'Removed' })
  async removeSavedSeller(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sellerId') sellerId: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyerService.removeSavedSeller(user.id, sellerId);
    return ApiResponseDto.success('Seller removed from saved list', data);
  }

  // ── Module 19: Profile ────────────────────────────────────────────────────

  /** GET /api/buyer/profile */
  @Get('profile')
  @ApiOperation({ summary: 'Get buyer profile' })
  async getProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyerService.getProfile(user.id);
    return ApiResponseDto.success('Profile retrieved', data);
  }

  /** PATCH /api/buyer/profile */
  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Update buyer profile (businessType, GSTIN, companyName)' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBuyerProfileDto,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyerService.updateProfile(user.id, dto);
    return ApiResponseDto.success('Profile updated', data);
  }

  // ── Module 19: Saved items ─────────────────────────────────────────────────

  /** GET /api/buyer/saved — unified saved sellers + products */
  @Get('saved')
  @ApiOperation({ summary: 'Get all saved items (sellers + products)' })
  async getAllSaved(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyerService.getAllSaved(user.id);
    return ApiResponseDto.success('Saved items retrieved', data);
  }

  /** POST /api/buyer/save/seller/:sellerId — toggle */
  @Post('save/seller/:sellerId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle save/unsave a seller' })
  async toggleSaveSeller(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sellerId') sellerId: string,
  ): Promise<ApiResponseDto<any>> {
    // Reuses existing saveSeller / removeSavedSeller logic as a toggle
    const data = await this.buyerService.saveSeller(user.id, sellerId);
    return ApiResponseDto.success(data.saved ? 'Seller saved' : 'Seller unsaved', data);
  }

  /** POST /api/buyer/save/product/:productId — toggle */
  @Post('save/product/:productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle save/unsave a product' })
  async toggleSaveProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyerService.toggleSaveProduct(user.id, productId);
    return ApiResponseDto.success(data.saved ? 'Product saved' : 'Product unsaved', data);
  }

  /** POST /api/buyer/change-password */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change buyer account password' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { currentPassword: string; newPassword: string },
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyerService.changePassword(user.id, dto.currentPassword, dto.newPassword);
    return ApiResponseDto.success('Password changed successfully', data);
  }
}
