import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly client: any;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    this.keyId     = this.config.get<string>('RAZORPAY_KEY_ID')     ?? 'rzp_test_placeholder';
    this.keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET') ?? 'placeholder_secret';
    this.webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') ?? 'webhook_secret';

    this.client = new Razorpay({
      key_id: this.keyId,
      key_secret: this.keySecret,
    });

    this.logger.log(`Razorpay initialised (key: ${this.keyId.slice(0, 10)}...)`);
  }

  /**
   * Create a Razorpay order.
   * @param amountPaise   Amount in PAISE (INR × 100)
   * @param receipt       Internal reference (transactionId or orderId)
   * @param notes         Optional key-value metadata stored on the order
   */
  async createOrder(
    amountPaise: number,
    receipt: string,
    notes: Record<string, string> = {},
  ): Promise<{ id: string; amount: number; currency: string }> {
    if (this.keyId.includes('placeholder') || this.keyId === 'rzp_test_your_test_key_id') {
      throw new BadRequestException(
        'Razorpay is not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env.local file.',
      );
    }

    try {
      const order = await (this.client.orders.create as any)({
        amount: amountPaise,
        currency: 'INR',
        receipt,
        notes,
        payment_capture: true,
      });

      this.logger.log(`Razorpay order created: ${order.id} for receipt ${receipt}`);

      return {
        id: order.id as string,
        amount: order.amount as number,
        currency: order.currency as string,
      };
    } catch (err: any) {
      this.logger.error(`Razorpay createOrder failed: ${err?.error?.description ?? err.message}`);
      throw new InternalServerErrorException('Payment gateway error. Please try again.');
    }
  }

  /**
   * Verify Razorpay payment signature (HMAC SHA256).
   * The signature is computed over `${orderId}|${paymentId}`.
   */
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const body = `${orderId}|${paymentId}`;
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(body)
      .digest('hex');

    const valid = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex'),
    );

    if (!valid) {
      this.logger.warn(`Signature mismatch for orderId=${orderId} paymentId=${paymentId}`);
    }

    return valid;
  }

  /**
   * Verify Razorpay webhook signature.
   * Signature is HMAC SHA256 of the raw request body with the webhook secret.
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex'),
      );
    } catch {
      return false;
    }
  }

  /**
   * Fetch payment details from Razorpay (used for admin reconciliation).
   */
  async getPaymentDetails(paymentId: string): Promise<any> {
    try {
      return await (this.client.payments.fetch as any)(paymentId);
    } catch (err: any) {
      this.logger.error(`getPaymentDetails failed for ${paymentId}: ${err.message}`);
      throw new BadRequestException('Could not fetch payment details');
    }
  }

  /**
   * Initiate a refund for a payment.
   * @param paymentId  Razorpay payment ID
   * @param amountPaise  Amount to refund in paise (omit for full refund)
   */
  async refundPayment(paymentId: string, amountPaise?: number): Promise<any> {
    try {
      const params: any = { speed: 'normal' };
      if (amountPaise) params.amount = amountPaise;

      const refund = await (this.client.payments.refund as any)(paymentId, params);
      this.logger.log(`Refund initiated: ${refund.id} for payment ${paymentId}`);
      return refund;
    } catch (err: any) {
      this.logger.error(`Refund failed for ${paymentId}: ${err.message}`);
      throw new InternalServerErrorException('Refund initiation failed');
    }
  }

  getKeyId(): string {
    return this.keyId;
  }

  /** True when running without real Razorpay credentials (test/dev sandbox mode). */
  isMockMode(): boolean {
    return (
      this.keyId.includes('placeholder') ||
      this.keyId === 'rzp_test_your_test_key_id' ||
      this.keyId === ''
    );
  }

  /**
   * Generate a deterministic mock HMAC signature so verifyPaymentSignature
   * passes in mock mode without a real secret.
   */
  mockSignature(orderId: string, paymentId: string): string {
    return crypto
      .createHmac('sha256', 'mock_secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  }
}
