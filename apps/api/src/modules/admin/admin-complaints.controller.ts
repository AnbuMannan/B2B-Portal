import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsIn, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { AdminComplaintsService } from './admin-complaints.service';

class AdminRespondDto {
  @ApiProperty()
  @IsString() @IsNotEmpty() @MinLength(5) @MaxLength(5000)
  message!: string;

  @ApiPropertyOptional({ enum: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'] })
  @IsOptional() @IsIn(['IN_PROGRESS', 'RESOLVED', 'CLOSED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(2000)
  adminNotes?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isInternal?: boolean;
}

class EscalateDto {
  @ApiProperty()
  @IsString() @IsNotEmpty() @MinLength(10) @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({ description: 'Admin user ID to escalate to' })
  @IsOptional() @IsString()
  escalateTo?: string;
}

@ApiTags('admin-complaints')
@ApiBearerAuth()
@Controller('admin/complaints')
@UseGuards(AdminRolesGuard)
export class AdminComplaintsController {
  constructor(private readonly service: AdminComplaintsService) {}

  @Get('stats')
  @AdminRoles('SUPER_ADMIN', 'ADMIN', 'SUPPORT')
  @ApiOperation({ summary: 'Complaint stats: open, in-progress, resolved, SLA breaches' })
  async getStats(): Promise<ApiResponseDto<any>> {
    return ApiResponseDto.success('Stats fetched', await this.service.getStats());
  }

  @Get('sla-breaches')
  @AdminRoles('SUPER_ADMIN', 'ADMIN', 'SUPPORT')
  @ApiOperation({ summary: 'All tickets past 48h SLA' })
  async getSlaBreaches(): Promise<ApiResponseDto<any>> {
    return ApiResponseDto.success('SLA breaches fetched', await this.service.getSlaBreaches());
  }

  @Get()
  @AdminRoles('SUPER_ADMIN', 'ADMIN', 'SUPPORT')
  @ApiOperation({ summary: 'List all complaints with filters' })
  async list(
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('slaBreach') slaBreach?: string,
    @Query('escalated') escalated?: string,
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 30,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.service.listTickets({
      status,
      category,
      slaBreachOnly: slaBreach === 'true',
      escalatedOnly: escalated === 'true',
      search,
      page: +page,
      limit: +limit,
    });
    return ApiResponseDto.success('Complaints fetched', result);
  }

  @Get(':id')
  @AdminRoles('SUPER_ADMIN', 'ADMIN', 'SUPPORT')
  @ApiOperation({ summary: 'Get full complaint detail with response history' })
  async getTicket(@Param('id') id: string): Promise<ApiResponseDto<any>> {
    return ApiResponseDto.success('Ticket fetched', await this.service.getTicket(id));
  }

  @Post(':id/respond')
  @AdminRoles('SUPER_ADMIN', 'ADMIN', 'SUPPORT')
  @ApiOperation({ summary: 'Add response or internal note; optionally change status' })
  async respond(
    @Param('id') id: string,
    @Body() dto: AdminRespondDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    return ApiResponseDto.success('Response added', await this.service.respond(id, user.id, dto));
  }

  @Post(':id/escalate')
  @AdminRoles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Escalate ticket to senior admin' })
  async escalate(
    @Param('id') id: string,
    @Body() dto: EscalateDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<any>> {
    return ApiResponseDto.success('Ticket escalated', await this.service.escalate(id, user.id, dto));
  }
}
