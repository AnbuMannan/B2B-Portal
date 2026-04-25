import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { ComplaintsService } from './complaints.service';
import {
  AdminRespondDto,
  CreateComplaintDto,
  CreateGrievanceContactDto,
} from './dto/complaint.dto';

@ApiTags('complaints')
@Controller()
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  /** POST /api/complaints — authenticated BUYER or SELLER */
  @Post('complaints')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'File a complaint against another user' })
  async createComplaint(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateComplaintDto,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.complaintsService.createComplaint(user.id, dto);
    return ApiResponseDto.success('Complaint filed successfully', data);
  }

  /** GET /api/complaints/my — own complaints */
  @Get('complaints/my')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: "Get authenticated user's complaints" })
  async getMyComplaints(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.complaintsService.getMyComplaints(user.id);
    return ApiResponseDto.success('Complaints retrieved', data);
  }

  /** GET /api/complaints/:id — own ticket or admin */
  @Get('complaints/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get complaint detail (own or admin)' })
  async getComplaint(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.complaintsService.getComplaint(user.id, id, user.role);
    return ApiResponseDto.success('Complaint retrieved', data);
  }

  /** POST /api/complaints/:id/respond — ADMIN only */
  @Post('complaints/:id/respond')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Admin responds to a complaint ticket' })
  async respondToComplaint(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminRespondDto,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.complaintsService.respondToComplaint(user.id, id, dto);
    return ApiResponseDto.success('Response added', data);
  }

  /** POST /api/grievance-officer/contact — public, no auth required */
  @Post('grievance-officer/contact')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Public Grievance Officer contact form (IT Act / DPDP Act)' })
  async grievanceContact(
    @Body() dto: CreateGrievanceContactDto,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.complaintsService.submitGrievanceContact(dto);
    return ApiResponseDto.success('Grievance submitted', data);
  }
}
