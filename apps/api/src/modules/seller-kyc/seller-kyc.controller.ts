import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SellerKycService } from './seller-kyc.service';
import { KycStep1Dto } from './dto/kyc-step1.dto';
import { KycStep2Dto } from './dto/kyc-step2.dto';
import { KycStep3Dto } from './dto/kyc-step3.dto';
import { KycStep4Dto } from './dto/kyc-step4.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('seller-kyc')
@Controller('seller/kyc')
export class SellerKycController {
  constructor(private readonly sellerKycService: SellerKycService) {}

  @Post('step-1')
  @Roles('SELLER')
  @ApiOperation({ summary: 'KYC Step 1: Business Profile' })
  @ApiResponse({ status: 201, description: 'Step 1 saved' })
  async step1(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: KycStep1Dto,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.sellerKycService.saveStep1(user.id, dto);
    return ApiResponseDto.success('Business profile saved', result);
  }

  @Post('step-2')
  @Roles('SELLER')
  @ApiOperation({ summary: 'KYC Step 2: Address Details' })
  async step2(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: KycStep2Dto,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.sellerKycService.saveStep2(user.id, dto);
    return ApiResponseDto.success('Address saved', result);
  }

  @Post('step-3')
  @Roles('SELLER')
  @ApiOperation({ summary: 'KYC Step 3: Documents (GST, PAN, IEC, etc.)' })
  async step3(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: KycStep3Dto,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.sellerKycService.saveStep3(user.id, dto);
    return ApiResponseDto.success('Documents verified and saved', result);
  }

  @Post('step-4')
  @Roles('SELLER')
  @ApiOperation({ summary: 'KYC Step 4: Director / Proprietor Personal Details' })
  async step4(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: KycStep4Dto,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.sellerKycService.saveStep4(user.id, dto);
    return ApiResponseDto.success('Personal details saved', result);
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @Roles('SELLER')
  @ApiOperation({ summary: 'Submit KYC for admin review' })
  async submit(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.sellerKycService.submitKyc(user.id);
    return ApiResponseDto.success(result.message, result);
  }

  @Post('re-submit')
  @HttpCode(HttpStatus.OK)
  @Roles('SELLER')
  @ApiOperation({ summary: 'Re-submit KYC after rejection' })
  async reSubmit(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.sellerKycService.resubmitKyc(user.id);
    return ApiResponseDto.success(result.message, result);
  }

  @Get('status')
  @Roles('SELLER')
  @ApiOperation({ summary: 'Get current KYC status' })
  async getStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.sellerKycService.getKycStatus(user.id);
    return ApiResponseDto.success('KYC status retrieved', result);
  }
}

// ─── Verify endpoints (accessible to authenticated users for real-time validation) ───

@ApiTags('verify')
@Controller('verify')
export class VerifyController {
  constructor(private readonly sellerKycService: SellerKycService) {}

  @Post('gstin')
  @HttpCode(HttpStatus.OK)
  @Roles('SELLER')
  @ApiOperation({ summary: 'Verify GSTIN via GSTN API (with Redis caching)' })
  async verifyGstin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { gstin: string },
  ): Promise<ApiResponseDto<any>> {
    const result = await this.sellerKycService.verifyGstin(body.gstin, user.id);
    return ApiResponseDto.success('GSTIN verification complete', result);
  }

  @Get('pincode/:pincode')
  @ApiOperation({ summary: 'Lookup city and state by 6-digit pincode (India Post API)' })
  async lookupPincode(
    @Param('pincode') pincode: string,
  ): Promise<ApiResponseDto<any>> {
    const result = await this.sellerKycService.lookupPincode(pincode);
    return ApiResponseDto.success('Pincode lookup complete', result);
  }
}
