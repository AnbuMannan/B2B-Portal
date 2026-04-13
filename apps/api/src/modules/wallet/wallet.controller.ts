import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { WalletService } from './wallet.service';
import { CreateOrderDto, VerifyPaymentDto, SpendCreditDto } from './dto/wallet.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('seller/wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // ── GET /api/seller/wallet ────────────────────────────────────────────────

  @Get()
  @Roles('SELLER')
  @ApiOperation({ summary: 'Get wallet balance, transaction history, and credit packs' })
  @ApiResponse({ status: 200, description: 'Wallet data returned' })
  async getWallet(@CurrentUser() user: AuthenticatedUser): Promise<ApiResponseDto<any>> {
    const data = await this.walletService.getWallet(user.id);
    return ApiResponseDto.success('Wallet retrieved', data);
  }

  // ── POST /api/seller/wallet/create-order ─────────────────────────────────

  @Post('create-order')
  @Roles('SELLER')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a Razorpay order for credit pack purchase' })
  @ApiResponse({ status: 201, description: 'Razorpay order created' })
  async createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.walletService.createOrder(user.id, dto);
    return ApiResponseDto.success('Order created', data);
  }

  // ── POST /api/seller/wallet/verify-payment ───────────────────────────────

  @Post('verify-payment')
  @Roles('SELLER')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify Razorpay payment signature and credit the wallet',
  })
  @ApiResponse({ status: 200, description: 'Payment verified and credits added' })
  @ApiResponse({ status: 400, description: 'Invalid signature or order not found' })
  async verifyPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyPaymentDto,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.walletService.verifyPayment(user.id, dto);
    return ApiResponseDto.success('Payment verified. Credits added to wallet.', data);
  }

  // ── POST /api/seller/wallet/spend-credit (internal) ──────────────────────

  @Post('spend-credit')
  @Roles('SELLER')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deduct credits from wallet (called by buy-leads reveal flow)' })
  @ApiResponse({ status: 200, description: 'Credit deducted' })
  @ApiResponse({ status: 400, description: 'Insufficient credits' })
  async spendCredit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SpendCreditDto,
  ): Promise<ApiResponseDto<any>> {
    // Resolve sellerId from userId
    const seller = await this.walletService['getVerifiedSeller'](user.id);
    const data   = await this.walletService.spendCredit(seller.id, dto);
    return ApiResponseDto.success('Credit deducted', data);
  }

  // ── GET /api/seller/wallet/invoice/:transactionId ────────────────────────

  @Get('invoice/:transactionId')
  @Roles('SELLER')
  @ApiOperation({ summary: 'Download GST invoice for a credit purchase transaction' })
  @ApiResponse({ status: 200, description: 'Invoice file (HTML or PDF)' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async downloadInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('transactionId') transactionId: string,
    @Res() res: Response,
  ) {
    const invoice = await this.walletService.getInvoice(user.id, transactionId);

    if (invoice.isHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${invoice.invoiceNumber}.html"`,
      );
    } else {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      );
    }

    res.send(invoice.buffer);
  }
}
