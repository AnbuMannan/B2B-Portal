import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// ── Credit pack definitions ───────────────────────────────────────────────

export const CREDIT_PACKS = {
  starter:    { id: 'starter',    name: 'Starter',    credits: 18,  baseAmount: 1500  },
  standard:   { id: 'standard',   name: 'Standard',   credits: 40,  baseAmount: 3000  },
  pro:        { id: 'pro',        name: 'Pro',        credits: 70,  baseAmount: 5000  },
  enterprise: { id: 'enterprise', name: 'Enterprise', credits: 150, baseAmount: 10000 },
} as const;

export type CreditPackId = keyof typeof CREDIT_PACKS;

export const GST_RATE = 0.18;

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  baseAmount: number;
  gstAmount: number;
  totalAmount: number;
  perCreditCost: number;
}

export function enrichPack(packId: CreditPackId): CreditPack {
  const p = CREDIT_PACKS[packId];
  const gstAmount   = Math.round(p.baseAmount * GST_RATE * 100) / 100;
  const totalAmount = p.baseAmount + gstAmount;
  return {
    ...p,
    gstAmount,
    totalAmount,
    perCreditCost: Math.round((p.baseAmount / p.credits) * 100) / 100,
  };
}

// ── Request DTOs ──────────────────────────────────────────────────────────

export class CreateOrderDto {
  @ApiProperty({ example: 'standard', enum: ['starter', 'standard', 'pro', 'enterprise'] })
  @IsEnum(['starter', 'standard', 'pro', 'enterprise'])
  packId: CreditPackId;
}

export class VerifyPaymentDto {
  @ApiProperty({ example: 'order_abc123' })
  @IsString()
  @IsNotEmpty()
  razorpayOrderId: string;

  @ApiProperty({ example: 'pay_xyz789' })
  @IsString()
  @IsNotEmpty()
  razorpayPaymentId: string;

  @ApiProperty({ example: 'hmac_signature_here' })
  @IsString()
  @IsNotEmpty()
  razorpaySignature: string;
}

export class SpendCreditDto {
  @ApiProperty({ example: 'lead-reveal:leadId:sellerId', description: 'Idempotency reference' })
  @IsString()
  @IsNotEmpty()
  referenceId: string;

  @ApiProperty({ example: 1, description: 'Credits to deduct (default 1)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  credits?: number;
}
