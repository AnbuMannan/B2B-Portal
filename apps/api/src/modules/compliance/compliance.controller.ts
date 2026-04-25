import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { ComplianceService } from './compliance.service';
import { RecordConsentDto, WithdrawConsentDto, DeleteAccountDto, GrievanceDto } from './dto/compliance.dto';

@ApiTags('compliance')
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  // ── Consent endpoints (authenticated) ────────────────────────────────────────

  @Post('consent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Roles('SELLER', 'BUYER')
  @ApiOperation({ summary: 'Record user consent (DPDP Act §6)' })
  async recordConsent(
    @Body() dto: RecordConsentDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ): Promise<ApiResponseDto<any>> {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    const result = await this.complianceService.recordConsent(user.id, dto, ip, ua);
    return ApiResponseDto.success('Consent recorded', result);
  }

  @Post('consent/withdraw')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Roles('SELLER', 'BUYER')
  @ApiOperation({ summary: 'Withdraw a non-essential consent (DPDP Act §6)' })
  async withdrawConsent(
    @Body() dto: WithdrawConsentDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.complianceService.withdrawConsent(user.id, dto);
    return ApiResponseDto.success('Consent withdrawn', result);
  }

  @Get('consent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Roles('SELLER', 'BUYER')
  @ApiOperation({ summary: 'Get consent history and current state' })
  async getConsents(
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.complianceService.getConsentHistory(user.id);
    return ApiResponseDto.success('Consent history fetched', result);
  }

  // ── Data export endpoints ─────────────────────────────────────────────────────

  @Post('data-export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Roles('SELLER', 'BUYER')
  @ApiOperation({ summary: 'Request personal data export (DPDP Act §12 — Right to Portability)' })
  async requestExport(
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.complianceService.requestDataExport(user.id);
    return ApiResponseDto.success('Export request queued', result);
  }

  @Get('data-export/:requestId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Roles('SELLER', 'BUYER')
  @ApiOperation({ summary: 'Check data export status' })
  async getExportStatus(
    @Param('requestId') requestId: string,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.complianceService.getExportStatus(user.id, requestId);
    return ApiResponseDto.success('Export status fetched', result);
  }

  // ── Account deletion ──────────────────────────────────────────────────────────

  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Roles('SELLER', 'BUYER')
  @ApiOperation({ summary: 'Anonymize & delete account (DPDP Act §13 — Right to Erasure)' })
  async deleteAccount(
    @Body() dto: DeleteAccountDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.complianceService.deleteAccount(user.id, dto);
    return ApiResponseDto.success('Account deleted', result);
  }

  // ── Grievance Officer (public — no auth required; DPDP §13 legal obligation) ──

  @Post('grievance')
  @ApiOperation({ summary: 'Submit grievance to Grievance Officer (public endpoint — DPDP Act §13)' })
  async submitGrievance(
    @Body() dto: GrievanceDto,
    @CurrentUser() user?: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.complianceService.submitGrievance(dto, user?.id);
    return ApiResponseDto.success('Grievance submitted', result);
  }

  @Get('grievance/status')
  @ApiOperation({ summary: 'Check grievance status by ticket ID + email (public)' })
  @ApiQuery({ name: 'ticketId', required: true })
  @ApiQuery({ name: 'email', required: true })
  async getGrievanceStatus(
    @Query('ticketId') ticketId: string,
    @Query('email') email: string,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.complianceService.getGrievanceStatus(ticketId, email);
    return ApiResponseDto.success('Grievance status fetched', result);
  }

  // ── Admin: Grievance management ───────────────────────────────────────────────

  @Get('grievance/admin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: list all grievance tickets' })
  async listGrievances(
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.complianceService.listGrievances(status, +page, +limit);
    return ApiResponseDto.success('Grievances fetched', result);
  }

  @Post('grievance/admin/:ticketId/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: respond to a grievance ticket' })
  async respondToGrievance(
    @Param('ticketId') ticketId: string,
    @Body() body: { notes: string; status: string },
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.complianceService.respondToGrievance(ticketId, user.id, body.notes, body.status);
    return ApiResponseDto.success('Response recorded', result);
  }
}
