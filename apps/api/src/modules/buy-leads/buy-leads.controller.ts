import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { BuyLeadsService } from './buy-leads.service';
import { BuyLeadFilterDto, RevealedLeadsQueryDto } from './dto/buy-leads.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('buy-leads')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Roles('SELLER')
@Controller('buy-leads')
export class BuyLeadsController {
  constructor(private readonly buyLeadsService: BuyLeadsService) {}

  /**
   * GET /api/buy-leads
   * List open buy leads with masked buyer info. SELLER role required.
   */
  @Get()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'List open buy leads (sellers only, buyer contact masked)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'Seller role required' })
  async getLeads(
    @Query() query: BuyLeadFilterDto,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyLeadsService.getLeads(query, user.id);
    return ApiResponseDto.success('Buy leads retrieved', data);
  }

  /**
   * GET /api/buy-leads/new-count
   * Count of open leads posted since the seller's last login (lightweight badge endpoint).
   */
  @Get('new-count')
  @ApiOperation({ summary: 'Count of new leads since seller last login' })
  async getNewLeadsCount(@CurrentUser() user: any): Promise<ApiResponseDto<any>> {
    const data = await this.buyLeadsService.getNewLeadsCount(user.id);
    return ApiResponseDto.success('New leads count retrieved', data);
  }

  /**
   * GET /api/buy-leads/filter-categories
   * Returns categories that have at least one active open buy lead (for filter dropdown).
   */
  @Get('filter-categories')
  @ApiOperation({ summary: 'Active categories with open buy leads' })
  async getActiveCategories(): Promise<ApiResponseDto<any>> {
    const data = await this.buyLeadsService.getActiveCategories();
    return ApiResponseDto.success('Active categories retrieved', data);
  }

  /**
   * GET /api/buy-leads/wallet-balance
   * Returns seller wallet credit balance.
   */
  @Get('wallet-balance')
  @ApiOperation({ summary: 'Get seller lead credit wallet balance' })
  async getWalletBalance(@CurrentUser() user: any): Promise<ApiResponseDto<any>> {
    const data = await this.buyLeadsService.getWalletBalance(user.id);
    return ApiResponseDto.success('Wallet balance retrieved', data);
  }

  /**
   * GET /api/buy-leads/my-revealed
   * All leads this seller has already revealed.
   */
  @Get('my-revealed')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Get all buy leads revealed by this seller' })
  async getMyRevealedLeads(
    @Query() query: RevealedLeadsQueryDto,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyLeadsService.getMyRevealedLeads(query, user.id);
    return ApiResponseDto.success('Revealed leads retrieved', data);
  }

  /**
   * GET /api/buy-leads/:leadId
   * Single lead detail (still masked).
   */
  @Get(':leadId')
  @ApiOperation({ summary: 'Get single buy lead detail (masked)' })
  async getLeadById(
    @Param('leadId') leadId: string,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyLeadsService.getLeadById(leadId, user.id);
    return ApiResponseDto.success('Buy lead retrieved', data);
  }

  /**
   * POST /api/buy-leads/:leadId/reveal
   * Spend 1 credit to reveal buyer contact details. Idempotent.
   */
  @Post(':leadId/reveal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reveal buyer contact for a lead (spends 1 credit)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400, description: 'INSUFFICIENT_CREDITS' })
  @ApiResponse({ status: 403, description: 'KYC not approved' })
  async revealContact(
    @Param('leadId') leadId: string,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyLeadsService.revealContact(leadId, user.id);
    const msg = data.alreadyRevealed
      ? 'Contact already revealed (no credit charged)'
      : 'Contact revealed. 1 credit deducted.';
    return ApiResponseDto.success(msg, data);
  }
}
