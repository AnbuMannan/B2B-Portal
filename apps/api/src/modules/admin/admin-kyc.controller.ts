import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { AdminKycService } from './admin-kyc.service';
import { RejectKycDto } from './dto/reject-kyc.dto';

@ApiTags('admin-kyc')
@ApiBearerAuth()
@Controller('admin/kyc')
@UseGuards(AdminRolesGuard)
export class AdminKycController {
  constructor(private readonly kycService: AdminKycService) {}

  @Get('stats')
  @ApiOperation({ summary: 'KYC queue stats' })
  async getStats(): Promise<ApiResponseDto<any>> {
    const result = await this.kycService.getStats();
    return ApiResponseDto.success('KYC stats fetched', result);
  }

  @Get('queue')
  @AdminRoles('ADMIN', 'REVIEWER')
  @ApiOperation({ summary: 'Pending KYC queue — FIFO, oldest first' })
  async getQueue(): Promise<ApiResponseDto<any>> {
    const result = await this.kycService.getQueue();
    return ApiResponseDto.success('KYC queue fetched', result);
  }

  @Get(':sellerId')
  @AdminRoles('ADMIN', 'REVIEWER')
  @ApiOperation({ summary: 'Full seller KYC detail with gov API results' })
  async getDetail(
    @Param('sellerId') sellerId: string,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.kycService.getDetail(sellerId);
    return ApiResponseDto.success('KYC detail fetched', result);
  }

  @Post(':sellerId/approve')
  @AdminRoles('ADMIN')
  @ApiOperation({ summary: 'Approve seller KYC (ADMIN only)' })
  async approveKyc(
    @Param('sellerId') sellerId: string,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.kycService.approveKyc(sellerId, user.id);
    return ApiResponseDto.success('KYC approved successfully', result);
  }

  @Post(':sellerId/reject')
  @AdminRoles('ADMIN')
  @ApiOperation({ summary: 'Reject seller KYC with reason (ADMIN only)' })
  async rejectKyc(
    @Param('sellerId') sellerId: string,
    @Body() dto: RejectKycDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.kycService.rejectKyc(sellerId, user.id, dto);
    return ApiResponseDto.success('KYC rejected', result);
  }
}
