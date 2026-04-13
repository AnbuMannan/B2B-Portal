import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { RazorpayService } from '../../services/payment/razorpay.service';
import { GstInvoiceService } from '../../services/gst/gst-invoice.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'payments' },
    ),
  ],
  controllers: [WalletController],
  providers: [WalletService, RazorpayService, GstInvoiceService],
  exports: [WalletService],
})
export class WalletModule {}
