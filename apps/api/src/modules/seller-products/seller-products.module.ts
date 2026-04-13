import { Module } from '@nestjs/common';
import { SellerProductsController } from './seller-products.controller';
import { SellerProductsService } from './seller-products.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SellerProductsController],
  providers: [SellerProductsService],
  exports: [SellerProductsService],
})
export class SellerProductsModule {}
