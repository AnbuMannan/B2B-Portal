import { Controller, HttpCode, HttpStatus, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { OrdersService } from './orders.service';

@ApiTags('seller-orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Roles('SELLER')
@Controller('seller/orders')
export class SellerOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Patch(':orderId/fulfill')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seller marks an accepted order as fulfilled (dispatched/delivered)' })
  async fulfill(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.ordersService.sellerFulfillOrder(user.id, orderId);
    return ApiResponseDto.success('Order marked as fulfilled', data);
  }
}
