import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { AdminFinanceService } from './admin-finance.service';
import { ProcessRefundDto, TransactionFilterDto, GstrExportDto } from './dto/finance.dto';

@ApiTags('admin-finance')
@ApiBearerAuth()
@Controller('admin/finance')
@UseGuards(AdminRolesGuard)
@AdminRoles('SUPER_ADMIN', 'FINANCE')
export class AdminFinanceController {
  constructor(private readonly financeService: AdminFinanceService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Financial overview — revenue, GST, credits (last 30 days)' })
  async getOverview(): Promise<ApiResponseDto<any>> {
    const result = await this.financeService.getOverview();
    return ApiResponseDto.success('Finance overview fetched', result);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'All credit transactions (paginated, filterable)' })
  async getTransactions(
    @Query() dto: TransactionFilterDto,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.financeService.getTransactions(dto);
    return ApiResponseDto.success('Transactions fetched', result);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'All generated GST invoices' })
  async getInvoices(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.financeService.getInvoices(+page, +limit);
    return ApiResponseDto.success('Invoices fetched', result);
  }

  @Get('gstr1-export')
  @ApiOperation({ summary: 'Download GSTR-1 compatible CSV' })
  async downloadGstr1(
    @Query() dto: GstrExportDto,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.financeService.generateGstr1Csv(dto);
    const period = dto.period ?? new Date().toISOString().slice(0, 7);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="GSTR1_${period}.csv"`);
    res.send(csv);
  }

  @Get('ledger-export')
  @ApiOperation({ summary: 'Download full ledger CSV' })
  async downloadLedger(
    @Query() dto: TransactionFilterDto,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.financeService.generateLedgerCsv(dto);
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Ledger_${today}.csv"`);
    res.send(csv);
  }

  @Post('refund')
  @AdminRoles('SUPER_ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Process a refund via Razorpay' })
  async processRefund(
    @Body() dto: ProcessRefundDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.financeService.processRefund(dto, user.id);
    return ApiResponseDto.success('Refund processed successfully', result);
  }
}
