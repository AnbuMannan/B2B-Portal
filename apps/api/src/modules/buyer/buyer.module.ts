import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../services/redis/redis.module';
import { QueueModule } from '../queue/queue.module';
import { BuyerController } from './buyer.controller';
import { BuyerService } from './buyer.service';
import { GstinService } from '../../services/government/gstin.service';
import { RequirementsController } from './requirements/requirements.controller';
import { RequirementsService } from './requirements/requirements.service';
import { RequirementMatchingService } from './requirements/matching.service';
import { QuotesController } from './quotes/quotes.controller';
import { QuotesService } from './quotes/quotes.service';
import { OrdersController } from './orders/orders.controller';
import { SellerOrdersController } from './orders/seller-orders.controller';
import { OrdersService } from './orders/orders.service';
import { RazorpayService } from '../../services/payment/razorpay.service';

@Module({
  imports: [DatabaseModule, RedisModule, QueueModule],
  controllers: [
    BuyerController,
    RequirementsController,
    QuotesController,
    OrdersController,
    SellerOrdersController,
  ],
  providers: [
    BuyerService,
    GstinService,
    RequirementsService,
    RequirementMatchingService,
    QuotesService,
    OrdersService,
    RazorpayService,
  ],
  exports: [BuyerService, RequirementsService, QuotesService, OrdersService],
})
export class BuyerModule {}
