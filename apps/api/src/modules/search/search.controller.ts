import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { IsString, IsInt, Min, IsOptional } from 'class-validator';
import { Request } from 'express';
import { SearchService } from './search.service';
import { SearchRequestDto, AutocompleteQueryDto, IndexProductDto } from './dto/search.dto';

export class TrackClickDto {
  @IsString() query!: string;
  @IsString() productId!: string;
  @IsInt() @Min(0) position!: number;
  @IsString() @IsOptional() sessionId?: string;
}

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * POST /api/search
   * Public endpoint — runs Elasticsearch bool query with aggregations.
   * Falls back to Prisma ILIKE search if ES is unavailable.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async search(@Body() dto: SearchRequestDto, @Req() req: Request) {
    const userId = (req as any).user?.id ?? undefined;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ??
      req.socket?.remoteAddress ??
      undefined;

    return this.searchService.search(dto, userId, ipAddress);
  }

  /**
   * GET /api/search/autocomplete?q=cotton
   * Public endpoint — returns up to 5 product + 3 seller suggestions.
   * Redis-cached for 10 minutes.
   */
  @Get('autocomplete')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async autocomplete(@Query() query: AutocompleteQueryDto) {
    return this.searchService.autocomplete(query.q);
  }

  /**
   * POST /api/search/index-product
   * Internal endpoint — called by BullMQ search-sync consumer.
   * Fetches product from DB and upserts into Elasticsearch.
   */
  @Post('index-product')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async indexProduct(@Body() dto: IndexProductDto) {
    await this.searchService.indexProduct(dto.productId);
    return { success: true, productId: dto.productId };
  }

  /**
   * GET /api/search/trending
   * Public endpoint — returns top 6 most-viewed products (used on zero-results page).
   */
  @Get('trending')
  async trending() {
    return this.searchService.getTrendingProducts(6);
  }

  /**
   * POST /api/search/track-click
   * Records which result was clicked and at what position (CTR tracking).
   * Best-effort — never throws on failure.
   */
  @Post('track-click')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async trackClick(@Body() dto: TrackClickDto, @Req() req: Request) {
    const userId = (req as any).user?.id ?? undefined;
    await this.searchService.trackClick(dto.query, dto.productId, dto.position, userId).catch(() => undefined);
    return { tracked: true };
  }
}
