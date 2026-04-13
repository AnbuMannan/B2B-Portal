import { Module } from '@nestjs/common';
import { RazorpayWebhookController } from './razorpay-webhook.controller';
import { RazorpayService } from '../../services/payment/razorpay.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [RazorpayWebhookController],
  providers: [RazorpayService],
})
export class WebhooksModule {}
