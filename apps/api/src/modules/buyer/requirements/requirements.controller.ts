import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { RequirementsService } from './requirements.service';
import {
  CreateRequirementDto,
  UpdateRequirementDto,
} from './dto/requirement.dto';

@ApiTags('buyer-requirements')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Roles('BUYER')
@Controller('buyer/requirements')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class RequirementsController {
  constructor(private readonly service: RequirementsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Post a new buy requirement' })
  @ApiResponse({ status: 201, description: 'Requirement created' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRequirementDto,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.service.create(user.id, dto);
    return ApiResponseDto.success('Requirement posted', data);
  }

  @Get()
  @ApiOperation({ summary: 'List my buy requirements' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponseDto<any>> {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const l = Math.min(50, Math.max(1, parseInt(limit ?? '20', 10) || 20));
    const data = await this.service.list(user.id, p, l);
    return ApiResponseDto.success('Requirements retrieved', data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single requirement by id' })
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.service.getOne(user.id, id);
    return ApiResponseDto.success('Requirement retrieved', data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a buy requirement (before any reveal)' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRequirementDto,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.service.update(user.id, id, dto);
    return ApiResponseDto.success('Requirement updated', data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel (soft-delete) a buy requirement' })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.service.cancel(user.id, id);
    return ApiResponseDto.success('Requirement cancelled', data);
  }

  @Post(':id/repost')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Repost an existing requirement (new 30-day expiry)' })
  async repost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.service.repost(user.id, id);
    return ApiResponseDto.success('Requirement reposted', data);
  }
}
