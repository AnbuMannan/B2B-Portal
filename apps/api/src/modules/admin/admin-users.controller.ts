import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsIn, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { AdminUsersService } from './admin-users.service';

class UpdateUserDto {
  @ApiPropertyOptional({ enum: ['SELLER', 'BUYER', 'ADMIN'] })
  @IsOptional() @IsIn(['SELLER', 'BUYER', 'ADMIN'])
  role?: string;

  @ApiPropertyOptional({ enum: ['SUPER_ADMIN', 'ADMIN', 'REVIEWER', 'FINANCE', 'SUPPORT'], nullable: true })
  @IsOptional()
  adminRole?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  phoneVerified?: boolean;
}

class ResetPasswordDto {
  @ApiProperty()
  @IsString() @IsNotEmpty() @MinLength(8) @MaxLength(128)
  newPassword!: string;
}

@ApiTags('admin-users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(AdminRolesGuard)
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get('stats')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'User stats: totals by role, inactive count, new this month' })
  async getStats(): Promise<ApiResponseDto<any>> {
    return ApiResponseDto.success('Stats fetched', await this.service.getUserStats());
  }

  @Get()
  @AdminRoles('SUPER_ADMIN', 'ADMIN', 'SUPPORT')
  @ApiOperation({ summary: 'List all users with search/filter/pagination' })
  async list(
    @Query('page') page = 1,
    @Query('limit') limit = 30,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('isActive') isActive?: string,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.service.listUsers({
      page: +page,
      limit: +limit,
      search,
      role,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
    return ApiResponseDto.success('Users fetched', result);
  }

  @Get(':id')
  @AdminRoles('SUPER_ADMIN', 'ADMIN', 'SUPPORT')
  @ApiOperation({ summary: 'Get single user detail' })
  async getUser(@Param('id') id: string): Promise<ApiResponseDto<any>> {
    return ApiResponseDto.success('User fetched', await this.service.getUser(id));
  }

  @Patch(':id')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update user role, adminRole, isActive, phoneVerified' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() admin: { id: string },
  ): Promise<ApiResponseDto<any>> {
    return ApiResponseDto.success('User updated', await this.service.updateUser(id, admin.id, dto));
  }

  @Post(':id/deactivate')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Deactivate (suspend) a user account' })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
  ): Promise<ApiResponseDto<any>> {
    return ApiResponseDto.success('User deactivated', await this.service.deactivateUser(id, admin.id));
  }

  @Post(':id/reactivate')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Reactivate a suspended user account' })
  async reactivate(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
  ): Promise<ApiResponseDto<any>> {
    return ApiResponseDto.success('User reactivated', await this.service.reactivateUser(id, admin.id));
  }

  @Post(':id/reset-password')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Force-reset a user password' })
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() admin: { id: string },
  ): Promise<ApiResponseDto<any>> {
    return ApiResponseDto.success('Password reset', await this.service.resetPassword(id, admin.id, dto.newPassword));
  }

  @Delete(':id')
  @AdminRoles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Soft-delete a user (SUPER_ADMIN only)' })
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
  ): Promise<ApiResponseDto<any>> {
    return ApiResponseDto.success('User deleted', await this.service.softDeleteUser(id, admin.id));
  }
}
