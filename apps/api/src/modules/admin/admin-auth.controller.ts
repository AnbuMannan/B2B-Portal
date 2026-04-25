import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Admin login — rate limited 5/15 min' })
  @ApiResponse({ status: 200, description: 'Admin JWT issued (4h session)' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: AdminLoginDto,
    @Req() req: Request,
  ): Promise<ApiResponseDto<any>> {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip ??
      'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    const result = await this.adminAuthService.login(dto, ipAddress, userAgent);
    return ApiResponseDto.success('Admin login successful', result);
  }
}
