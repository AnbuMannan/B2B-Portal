import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../services/redis/redis.module';
import { EncryptionUtil } from '../../common/utils/encryption.util';
import { EncryptionService } from '../../database/encryption.service';
import { BuyLeadsController } from './buy-leads.controller';
import { BuyLeadsService } from './buy-leads.service';
import { SellerLeadsController } from './seller-leads.controller';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [BuyLeadsController, SellerLeadsController],
  providers: [BuyLeadsService, EncryptionUtil, EncryptionService],
  exports: [BuyLeadsService],
})
export class BuyLeadsModule {}
