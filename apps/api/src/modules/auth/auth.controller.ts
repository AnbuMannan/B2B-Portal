import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from './strategies/jwt.strategy';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new buyer or seller account' })
  @ApiResponse({ status: 201, description: 'Registration successful; OTP sent if phone provided' })
  @ApiResponse({ status: 409, description: 'Email or phone already in use' })
  async register(@Body() dto: RegisterDto): Promise<ApiResponseDto<any>> {
    const result = await this.authService.register(dto);
    return ApiResponseDto.success('Registration successful', result);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify phone OTP and receive JWT tokens' })
  @ApiResponse({ status: 200, description: 'OTP verified, tokens issued' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto): Promise<ApiResponseDto<any>> {
    const result = await this.authService.verifyOtp(dto);
    return ApiResponseDto.success('Phone verified successfully', result);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto): Promise<ApiResponseDto<any>> {
    const result = await this.authService.login(dto);
    return ApiResponseDto.success('Login successful', result);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and get new access token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshToken(@Body() dto: RefreshTokenDto): Promise<ApiResponseDto<any>> {
    const result = await this.authService.refreshToken(dto);
    return ApiResponseDto.success('Tokens refreshed', result);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ApiResponseDto<any>> {
    const result = await this.authService.forgotPassword(dto);
    return ApiResponseDto.success(result.message);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from email' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<ApiResponseDto<any>> {
    const result = await this.authService.resetPassword(dto);
    return ApiResponseDto.success(result.message);
  }

  // ─── 2FA / TOTP endpoints ────────────────────────────────────────────────

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get 2FA enabled status for current user' })
  async get2faStatus(@CurrentUser() user: AuthenticatedUser): Promise<ApiResponseDto<any>> {
    const result = await this.authService.get2faStatus(user.id);
    return ApiResponseDto.success('2FA status retrieved', result);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate TOTP secret and QR code — call before verify' })
  async setup2fa(@CurrentUser() user: AuthenticatedUser): Promise<ApiResponseDto<any>> {
    const result = await this.authService.setup2fa(user.id);
    return ApiResponseDto.success('2FA setup initiated', result);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify TOTP token and enable 2FA' })
  async verify2fa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { token: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.authService.verify2fa(user.id, body.token);
    return ApiResponseDto.success('2FA enabled successfully', result);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA after verifying a live TOTP token' })
  async disable2fa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { token: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.authService.disable2fa(user.id, body.token);
    return ApiResponseDto.success('2FA disabled successfully', result);
  }
}
