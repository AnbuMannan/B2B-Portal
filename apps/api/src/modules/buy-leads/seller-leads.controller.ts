import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BuyLeadsService } from './buy-leads.service';
import { PaginationQueryDto } from './dto/buy-leads.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('seller-leads')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Roles('SELLER')
@Controller('seller')
export class SellerLeadsController {
  constructor(private readonly buyLeadsService: BuyLeadsService) {}

  /**
   * GET /api/seller/matched-leads
   * Open leads whose categoryId matches the seller's approved product categories.
   * Expiring soon (< 2 days) pinned to top via SQL CASE WHEN.
   * Redis cache: seller:leads:{sellerId}:{page} — 5 min TTL.
   */
  @Get('matched-leads')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Get buy leads matching seller product categories' })
  @ApiResponse({ status: 200 })
  async getMatchedLeads(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyLeadsService.getMatchedLeads(
      user.id,
      query.page ?? 1,
      query.limit ?? 20,
    );
    return ApiResponseDto.success('Matched leads retrieved', data);
  }

  /**
   * GET /api/seller/lead-feed
   * Combined feed: matched leads first (page 1), then all other open leads.
   */
  @Get('lead-feed')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Combined lead feed (matched first, then all open)' })
  async getLeadFeed(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyLeadsService.getLeadFeed(
      user.id,
      query.page ?? 1,
      query.limit ?? 20,
    );
    return ApiResponseDto.success('Lead feed retrieved', data);
  }

  /**
   * GET /api/seller/leads/saved
   * Returns the seller's bookmarked/saved buy leads.
   */
  @Get('leads/saved')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: "Get seller's saved/bookmarked leads" })
  async getSavedLeads(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyLeadsService.getSavedLeads(
      user.id,
      query.page ?? 1,
      query.limit ?? 20,
    );
    return ApiResponseDto.success('Saved leads retrieved', data);
  }

  /**
   * GET /api/seller/leads/saved-ids
   * Returns array of saved lead IDs for client-side state hydration.
   */
  @Get('leads/saved-ids')
  @ApiOperation({ summary: 'Get IDs of all saved leads (for UI state hydration)' })
  async getSavedLeadIds(@CurrentUser() user: any): Promise<ApiResponseDto<any>> {
    const ids = await this.buyLeadsService.getSavedLeadIds(user.id);
    return ApiResponseDto.success('Saved lead IDs retrieved', { ids });
  }

  /**
   * GET /api/seller/leads/conversion-rate
   * Returns the seller's lead conversion stat for the dashboard.
   */
  @Get('leads/conversion-rate')
  @ApiOperation({ summary: "Get seller's lead conversion rate stat" })
  async getConversionRate(@CurrentUser() user: any): Promise<ApiResponseDto<any>> {
    const data = await this.buyLeadsService.getConversionRate(user.id);
    return ApiResponseDto.success('Conversion rate retrieved', data);
  }

  /**
   * POST /api/seller/leads/:leadId/save
   * Toggle save/unsave a lead (no credit cost).
   */
  @Post('leads/:leadId/save')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save or unsave a buy lead (bookmark toggle)' })
  async saveLead(
    @Param('leadId') leadId: string,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyLeadsService.saveLead(user.id, leadId);
    const msg = data.saved ? 'Lead saved to watchlist' : 'Lead removed from watchlist';
    return ApiResponseDto.success(msg, data);
  }

  /**
   * POST /api/seller/leads/:leadId/convert
   * Marks a revealed lead contact as converted to an order.
   */
  @Post('leads/:leadId/convert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a revealed lead as converted to an order' })
  async markConverted(
    @Param('leadId') leadId: string,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyLeadsService.markConverted(user.id, leadId);
    const msg = data.alreadyMarked
      ? 'Already marked as converted'
      : 'Lead marked as converted';
    return ApiResponseDto.success(msg, data);
  }
}
