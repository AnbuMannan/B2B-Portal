import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { AdminFraudService } from './admin-fraud.service';
import { BlockUserDto, UnblockUserDto } from './dto/fraud.dto';

@ApiTags('admin-fraud')
@ApiBearerAuth()
@Controller('admin/fraud')
@UseGuards(AdminRolesGuard)
@AdminRoles('SUPER_ADMIN', 'ADMIN')
export class AdminFraudController {
  constructor(private readonly fraudService: AdminFraudService) {}

  @Get('suspicious')
  @ApiOperation({ summary: 'Buyers flagged by automated fraud rules' })
  async getSuspicious(): Promise<ApiResponseDto<any>> {
    const result = await this.fraudService.getSuspiciousAccounts();
    return ApiResponseDto.success('Suspicious accounts fetched', result);
  }

  @Get('blocklist')
  @ApiOperation({ summary: 'All actively blocked accounts' })
  async getBlockList(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.fraudService.getBlockList(+page, +limit);
    return ApiResponseDto.success('Block list fetched', result);
  }

  @Get('leads-by-state')
  @ApiOperation({ summary: 'Lead count by delivery state (for heatmap)' })
  async getLeadsByState(): Promise<ApiResponseDto<any>> {
    const result = await this.fraudService.getLeadsByState();
    return ApiResponseDto.success('Leads by state fetched', result);
  }

  @Post('block')
  @ApiOperation({ summary: 'Block a user account (deactivate + add to blocklist)' })
  async blockUser(
    @Body() dto: BlockUserDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.fraudService.blockUser(dto, user.id);
    return ApiResponseDto.success('User blocked', result);
  }

  @Post('unblock')
  @ApiOperation({ summary: 'Restore a blocked user account' })
  async unblockUser(
    @Body() dto: UnblockUserDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.fraudService.unblockUser(dto, user.id);
    return ApiResponseDto.success('User unblocked', result);
  }
}
