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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { QuotesService } from './quotes.service';
import { NegotiateQuoteDto } from './dto/quote-actions.dto';

@ApiTags('buyer-quotes')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Roles('BUYER')
@Controller('buyer/quotes')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class QuotesController {
  constructor(private readonly service: QuotesService) {}

  @Get()
  @ApiOperation({ summary: 'List all quotes grouped by requirement' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.service.listByRequirement(user.id);
    return ApiResponseDto.success('Quotes retrieved', data);
  }

  @Get(':quoteId')
  @ApiOperation({ summary: 'Get a single quote with seller + negotiation history' })
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quoteId') quoteId: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.service.getOne(user.id, quoteId);
    return ApiResponseDto.success('Quote retrieved', data);
  }

  @Post(':quoteId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a quote (finalizes order, rejects siblings)' })
  @ApiResponse({ status: 200, description: 'Quote accepted' })
  async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quoteId') quoteId: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.service.accept(user.id, quoteId);
    return ApiResponseDto.success('Quote accepted', data);
  }

  @Post(':quoteId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a quote' })
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quoteId') quoteId: string,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.service.reject(user.id, quoteId);
    return ApiResponseDto.success('Quote rejected', data);
  }

  @Post(':quoteId/negotiate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a counter-offer to the seller' })
  async negotiate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quoteId') quoteId: string,
    @Body() dto: NegotiateQuoteDto,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.service.negotiate(user.id, quoteId, dto);
    return ApiResponseDto.success('Counter-offer sent', data);
  }
}
