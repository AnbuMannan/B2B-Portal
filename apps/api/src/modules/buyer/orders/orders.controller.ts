import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { OrdersService } from './orders.service';
import { VerifyOrderPaymentDto } from './dto/order.dto';

@ApiTags('buyer-orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Roles('BUYER')
@Controller('buyer/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List all buyer orders (paginated, filterable by status)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.ordersService.listOrders(
      user.id,
      status,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    return ApiResponseDto.success('Orders retrieved', data);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get full order detail with pricing breakdown' })
  async getOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.ordersService.getOrder(user.id, orderId);
    return ApiResponseDto.success('Order retrieved', data);
  }

  @Post(':orderId/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate Razorpay payment for an accepted order' })
  async initiatePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.ordersService.initiatePayment(user.id, orderId);
    return ApiResponseDto.success('Payment order created', data);
  }

  @Post(':orderId/verify-payment')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Verify Razorpay payment signature and mark order paid' })
  async verifyPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Body() dto: VerifyOrderPaymentDto,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.ordersService.verifyPayment(user.id, orderId, dto);
    return ApiResponseDto.success('Payment verified', data);
  }

  @Post(':orderId/confirm-delivery')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buyer confirms delivery — marks order as FULFILLED' })
  async confirmDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.ordersService.confirmDelivery(user.id, orderId);
    return ApiResponseDto.success('Order marked as fulfilled', data);
  }
}
