import { IsOptional, IsString } from 'class-validator';

export class VerifyOrderPaymentDto {
  @IsString()
  razorpayOrderId!: string;

  @IsString()
  razorpayPaymentId!: string;

  @IsString()
  razorpaySignature!: string;
}

export class MarkPaidDto {
  @IsOptional()
  @IsString()
  receiptUrl?: string;
}
