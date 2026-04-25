import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SellerDashboardService } from './seller-dashboard.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('seller-dashboard')
@Controller('seller')
export class SellerDashboardController {
  constructor(private readonly dashboardService: SellerDashboardService) {}

  @Get('dashboard')
  @Roles('SELLER')
  @ApiOperation({ summary: 'Get aggregated seller dashboard data (KPIs, leads, orders, wallet)' })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  @ApiResponse({ status: 403, description: 'KYC not approved' })
  async getDashboard(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.dashboardService.getDashboard(user.id);
    return ApiResponseDto.success('Dashboard loaded', data);
  }

  @Get('notifications')
  @Roles('SELLER', 'BUYER')
  @ApiOperation({ summary: 'Get paginated seller notifications' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async getNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.dashboardService.getNotifications(user.id, page, limit);
    return ApiResponseDto.success('Notifications retrieved', data);
  }

  @Patch('notifications/read')
  @HttpCode(HttpStatus.OK)
  @Roles('SELLER', 'BUYER')
  @ApiOperation({ summary: 'Mark notifications as read (omit ids to mark all)' })
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { notificationIds?: string[] },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.dashboardService.markNotificationsRead(
      user.id,
      body.notificationIds,
    );
    return ApiResponseDto.success('Notifications marked as read', result);
  }

  @Get('orders')
  @Roles('SELLER')
  @ApiOperation({ summary: 'Get paginated seller orders with search/filter' })
  async getOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.dashboardService.getOrders(user.id, page, limit, status);
    return ApiResponseDto.success('Orders fetched', data);
  }

  @Patch('orders/:id/status')
  @HttpCode(HttpStatus.OK)
  @Roles('SELLER')
  @ApiOperation({ summary: 'Update order status (ACCEPTED, REJECTED, FULFILLED)' })
  async updateOrderStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Body() body: { status: string },
  ): Promise<ApiResponseDto<any>> {
    const data = await this.dashboardService.updateOrderStatus(user.id, orderId, body.status);
    return ApiResponseDto.success('Order status updated', data);
  }
}
