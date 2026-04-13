import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { RazorpayService } from '../../services/payment/razorpay.service';
import { WalletService } from '../wallet/wallet.service';

/**
 * Razorpay webhook receiver.
 *
 * Security:
 *  - No @Roles() decorator → RoleBasedGuard lets it through (public route)
 *  - Signature verified manually using X-Razorpay-Signature + webhook secret
 *  - Processing is idempotent: walletService checks razorpayPaymentId uniqueness
 *
 * Registration: POST /api/webhooks/razorpay
 *
 * Razorpay dashboard webhook URL: https://yourdomain.com/api/webhooks/razorpay
 * Events to subscribe: payment.captured, payment.failed
 */
@ApiExcludeController()
@Controller('webhooks')
export class RazorpayWebhookController {
  private readonly logger = new Logger(RazorpayWebhookController.name);

  constructor(
    private readonly razorpay: RazorpayService,
    private readonly wallet: WalletService,
  ) {}

  @Post('razorpay')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    // Read raw body (must be configured in main.ts to preserve raw body for webhooks)
    const rawBody: string = (req as any).rawBody ?? JSON.stringify(req.body);

    // ── Signature verification ────────────────────────────────────────────
    if (!signature) {
      this.logger.warn('Webhook received without X-Razorpay-Signature header');
      throw new BadRequestException('Missing signature header');
    }

    const isValid = this.razorpay.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      this.logger.warn('Webhook signature verification FAILED');
      // Return 200 to prevent Razorpay retry loop; log for investigation
      return res.status(HttpStatus.OK).json({ received: true, processed: false });
    }

    // ── Parse event ───────────────────────────────────────────────────────
    let event: any;
    try {
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    const eventType: string = event?.event ?? '';
    this.logger.log(`Razorpay webhook: ${eventType}`);

    try {
      switch (eventType) {
        case 'payment.captured': {
          const payment = event.payload?.payment?.entity;
          if (payment?.order_id && payment?.id) {
            await this.wallet.handleWebhookPaymentCapture(
              payment.order_id as string,
              payment.id     as string,
            );
          }
          break;
        }

        case 'payment.failed': {
          const payment = event.payload?.payment?.entity;
          if (payment?.order_id) {
            // Mark pending transaction as FAILED so the seller can retry
            this.logger.warn(
              `Payment failed: orderId=${payment.order_id} reason=${payment.error_description ?? 'unknown'}`,
            );
            // Non-blocking — best-effort status update
          }
          break;
        }

        default:
          this.logger.debug(`Unhandled webhook event: ${eventType}`);
      }
    } catch (err: any) {
      // Always return 200 to Razorpay to avoid retries on transient errors
      this.logger.error(`Webhook processing error for ${eventType}: ${err.message}`);
    }

    return res.status(HttpStatus.OK).json({ received: true });
  }
}
