import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SeoService } from './seo.service';

@ApiTags('seo')
@Controller('seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  /**
   * GET /api/seo/validate?url=https://example.com/product/123
   * Fetches the target page, extracts meta tags + JSON-LD structured data,
   * validates completeness, and returns a scored SEO report.
   *
   * Internal debug tool — no auth required but should be protected in production.
   */
  @Get('validate')
  @ApiOperation({ summary: 'Validate meta tags and JSON-LD structured data for a URL' })
  @ApiQuery({ name: 'url', required: true, example: 'http://localhost:4000/product/abc123' })
  @ApiResponse({ status: 200, description: 'SEO validation report' })
  async validate(@Query('url') url: string): Promise<any> {
    return this.seoService.validateUrl(url);
  }

  /**
   * GET /api/seo/validate/:encodedUrl (legacy param style)
   */
  @Get('validate/:encodedUrl')
  @ApiOperation({ summary: 'Validate SEO by URL path param (URL-encoded)' })
  @ApiParam({ name: 'encodedUrl', description: 'URL-encoded target URL' })
  async validateByParam(@Param('encodedUrl') encodedUrl: string): Promise<any> {
    return this.seoService.validateUrl(decodeURIComponent(encodedUrl));
  }
}
