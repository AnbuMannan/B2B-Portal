import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('admin-dashboard')
@ApiBearerAuth()
@Controller('admin/dashboard')
@UseGuards(AdminRolesGuard)
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Admin dashboard statistics' })
  async getStats(): Promise<ApiResponseDto<any>> {
    const result = await this.dashboardService.getStats();
    return ApiResponseDto.success('Dashboard stats fetched', result);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Current admin profile' })
  async getProfile(
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.dashboardService.getProfile(user.id);
    return ApiResponseDto.success('Profile fetched', result);
  }

  @Get('audit-logs')
  @AdminRoles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Paginated audit log with search/filter' })
  async getAuditLogs(
    @Query('page') page = 1,
    @Query('limit') limit = 30,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.dashboardService.getAuditLogs({ page: +page, limit: +limit, entityType, action, userId });
    return ApiResponseDto.success('Audit logs fetched', result);
  }

  @Get('admin-accounts')
  @AdminRoles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List all admin accounts' })
  async getAdminAccounts(): Promise<ApiResponseDto<any>> {
    return ApiResponseDto.success('Admin accounts fetched', await this.dashboardService.getAdminAccounts());
  }

  @Post('admin-accounts')
  @AdminRoles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new admin account' })
  async createAdminAccount(
    @Body() body: { email: string; password: string; adminRole: string },
    @CurrentUser() admin: { id: string },
  ): Promise<ApiResponseDto<any>> {
    return ApiResponseDto.success('Admin account created', await this.dashboardService.createAdminAccount(body, admin.id));
  }

  @Patch('admin-accounts/:id')
  @AdminRoles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update admin account role or status' })
  async updateAdminAccount(
    @Param('id') id: string,
    @Body() body: { adminRole?: string; isActive?: boolean },
    @CurrentUser() admin: { id: string },
  ): Promise<ApiResponseDto<any>> {
    return ApiResponseDto.success('Admin account updated', await this.dashboardService.updateAdminAccount(id, body, admin.id));
  }

  @Delete('admin-accounts/:id')
  @AdminRoles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Revoke admin access (sets adminRole to null)' })
  async revokeAdminAccount(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
  ): Promise<ApiResponseDto<any>> {
    return ApiResponseDto.success('Admin access revoked', await this.dashboardService.revokeAdminAccount(id, admin.id));
  }
}
