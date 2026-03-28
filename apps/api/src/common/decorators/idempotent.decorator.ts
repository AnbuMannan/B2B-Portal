import { SetMetadata } from '@nestjs/common';

/**
 * Marks an endpoint as requiring idempotency protection.
 * Requests with identical X-Request-ID will return cached results.
 * Applied automatically to financial endpoints (payment, refund, credit).
 *
 * Usage: @Post('recharge-wallet')
 *        @Idempotent()
 *        async rechargeWallet(...) { }
 */
export const Idempotent = () => SetMetadata('idempotent', true);
