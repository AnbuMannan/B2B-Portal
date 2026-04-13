import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SellerAnalyticsService, AnalyticsPeriod } from './seller-analytics.service';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';

const VALID_PERIODS: AnalyticsPeriod[] = ['7d', '30d', '90d'];

@ApiTags('seller-analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Roles('SELLER')
@Controller('seller')
export class SellerAnalyticsController {
  constructor(private readonly analyticsService: SellerAnalyticsService) {}

  /**
   * GET /api/seller/analytics?period=7d|30d|90d
   * Full analytics payload. Cached 1 hour per seller per period.
   */
  @Get('analytics')
  @ApiOperation({ summary: 'Seller analytics (views, leads, credits) by period' })
  @ApiQuery({ name: 'period', enum: ['7d', '30d', '90d'], required: false })
  async getAnalytics(
    @Query('period') period: string = '30d',
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto<any>> {
    const p: AnalyticsPeriod = VALID_PERIODS.includes(period as any)
      ? (period as AnalyticsPeriod)
      : '30d';
    const data = await this.analyticsService.getAnalytics(user.id, p);
    return ApiResponseDto.success('Analytics retrieved', data);
  }

  /**
   * GET /api/seller/analytics/export?period=7d|30d|90d
   * Returns a CSV file download with all analytics data.
   */
  @Get('analytics/export')
  @ApiOperation({ summary: 'Download analytics as CSV' })
  @ApiQuery({ name: 'period', enum: ['7d', '30d', '90d'], required: false })
  async exportCsv(
    @Query('period') period: string = '30d',
    @CurrentUser() user: any,
    @Res() res: Response,
  ): Promise<void> {
    const p: AnalyticsPeriod = VALID_PERIODS.includes(period as any)
      ? (period as AnalyticsPeriod)
      : '30d';

    const csv = await this.analyticsService.getExportCsv(user.id, p);
    const filename = `analytics-${p}-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
