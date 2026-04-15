import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsInt, Min, Max } from 'class-validator';
import { BuyLeadsService } from './buy-leads.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

class PostBuyLeadDto {
  @IsString() productName!: string;
  @IsString() @IsOptional() categoryId?: string;
  @IsNumber() @IsOptional() quantity?: number;
  @IsString() @IsOptional() unit?: string;
  @IsNumber() @IsOptional() targetPriceMin?: number;
  @IsNumber() @IsOptional() targetPriceMax?: number;
  @IsString() @IsOptional() expectedCountry?: string;
  @IsString() contactChannel!: string;
  @IsString() @IsOptional() repeatOption?: string;
  @IsInt() @Min(1) @Max(90) @IsOptional() expiresInDays?: number;
}

@ApiTags('buyer-leads')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Roles('BUYER')
@Controller('buyer/leads')
export class BuyerLeadsController {
  constructor(private readonly buyLeadsService: BuyLeadsService) {}

  /**
   * POST /api/buyer/leads
   * Buyer posts a new buy lead. Matching sellers receive in-app + email notifications.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Post a new buy lead — notifies matching sellers' })
  @ApiResponse({ status: 201 })
  async postLead(
    @Body() dto: PostBuyLeadDto,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.buyLeadsService.postBuyLead(user.id, dto);
    return ApiResponseDto.success('Buy lead posted. Matching sellers will be notified.', data);
  }
}
