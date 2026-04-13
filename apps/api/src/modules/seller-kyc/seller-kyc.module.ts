import { Module } from '@nestjs/common';
import { SellerKycController, VerifyController } from './seller-kyc.controller';
import { SellerKycService } from './seller-kyc.service';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../services/redis/redis.module';
import { QueueModule } from '../queue/queue.module';
import { GstinService } from '../../services/government/gstin.service';
import { PanService } from '../../services/government/pan.service';
import { IecService } from '../../services/government/iec.service';
import { PincodeService } from '../../services/government/pincode.service';

@Module({
  imports: [DatabaseModule, RedisModule, QueueModule],
  controllers: [SellerKycController, VerifyController],
  providers: [SellerKycService, GstinService, PanService, IecService, PincodeService],
  exports: [SellerKycService],
})
export class SellerKycModule {}
