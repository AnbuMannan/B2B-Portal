import { Module } from '@nestjs/common';
import { SellersController } from './sellers.controller';
import { SellersService } from './sellers.service';
import { SellerDashboardController } from './seller-dashboard.controller';
import { SellerDashboardService } from './seller-dashboard.service';
import { SellerAnalyticsController } from './analytics/seller-analytics.controller';
import { SellerAnalyticsService } from './analytics/seller-analytics.service';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../services/redis/redis.module';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [SellersController, SellerDashboardController, SellerAnalyticsController],
  providers: [SellersService, SellerDashboardService, SellerAnalyticsService],
  exports: [SellersService, SellerDashboardService],
})
export class SellersModule {}
