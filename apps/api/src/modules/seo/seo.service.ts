import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../database/database.service';

interface StructuredDataResult {
  type: string;
  valid: boolean;
  issues: string[];
  data: Record<string, any>;
}

interface SeoValidationResult {
  url: string;
  title: string | null;
  description: string | null;
  canonical: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  structuredData: StructuredDataResult[];
  issues: string[];
  score: number; // 0–100
  fetchedAt: string;
}

@Injectable()
export class SeoService {
  private readonly logger = new Logger(SeoService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches the given URL, parses meta tags and JSON-LD structured data,
   * validates completeness, and returns a scored SEO report.
   *
   * Designed for internal debug use — not for production scraping at scale.
   */
  async validateUrl(url: string): Promise<SeoValidationResult> {
    this.logger.log(`SEO validate: ${url}`);

    const issues: string[] = [];

    let html = '';
    try {
      const res = await axios.get(url, {
        timeout: 10_000,
        headers: { 'User-Agent': 'B2B-Portal-SEO-Validator/1.0' },
        maxRedirects: 5,
      });
      html = typeof res.data === 'string' ? res.data : '';
    } catch (err: any) {
      return {
        url,
        title: null,
        description: null,
        canonical: null,
        ogTitle: null,
        ogDescription: null,
        ogImage: null,
        structuredData: [],
        issues: [`Failed to fetch URL: ${err?.message ?? 'Unknown error'}`],
        score: 0,
        fetchedAt: new Date().toISOString(),
      };
    }

    // ── Meta extraction ────────────────────────────────────────────────────────
    const title = this._extractMeta(html, /<title[^>]*>([^<]+)<\/title>/i);
    const description = this._extractMetaTag(html, 'description');
    const canonical = this._extractHref(html, /rel="canonical"/i);
    const ogTitle = this._extractMetaProperty(html, 'og:title');
    const ogDescription = this._extractMetaProperty(html, 'og:description');
    const ogImage = this._extractMetaProperty(html, 'og:image');

    // ── Structured data extraction ─────────────────────────────────────────────
    const structuredData = this._extractStructuredData(html);

    // ── Issue detection ────────────────────────────────────────────────────────
    if (!title) issues.push('Missing <title> tag');
    else if (title.length < 10) issues.push('Title is too short (< 10 chars)');
    else if (title.length > 70) issues.push('Title is too long (> 70 chars)');

    if (!description) issues.push('Missing meta description');
    else if (description.length < 50) issues.push('Meta description too short (< 50 chars)');
    else if (description.length > 160) issues.push('Meta description too long (> 160 chars)');

    if (!canonical) issues.push('Missing canonical link tag');
    if (!ogTitle) issues.push('Missing og:title OpenGraph tag');
    if (!ogDescription) issues.push('Missing og:description OpenGraph tag');
    if (!ogImage) issues.push('Missing og:image OpenGraph tag — social shares will have no preview image');

    if (structuredData.length === 0) {
      issues.push('No JSON-LD structured data found');
    } else {
      structuredData.forEach((sd) => {
        if (!sd.valid) {
          issues.push(...sd.issues.map((i) => `[${sd.type}] ${i}`));
        }
      });
    }

    // ── Score calculation ──────────────────────────────────────────────────────
    const maxPoints = 100;
    let deductions = issues.length * 10;
    // Cap deductions so score never goes below 0
    const score = Math.max(0, maxPoints - deductions);

    return {
      url,
      title,
      description,
      canonical,
      ogTitle,
      ogDescription,
      ogImage,
      structuredData,
      issues,
      score,
      fetchedAt: new Date().toISOString(),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private _extractMeta(html: string, regex: RegExp): string | null {
    const m = html.match(regex);
    return m ? m[1].trim() : null;
  }

  private _extractMetaTag(html: string, name: string): string | null {
    const regex = new RegExp(
      `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
      'i',
    );
    const regex2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`,
      'i',
    );
    const m = html.match(regex) ?? html.match(regex2);
    return m ? m[1].trim() : null;
  }

  private _extractMetaProperty(html: string, property: string): string | null {
    const regex = new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      'i',
    );
    const regex2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
      'i',
    );
    const m = html.match(regex) ?? html.match(regex2);
    return m ? m[1].trim() : null;
  }

  private _extractHref(html: string, relRegex: RegExp): string | null {
    // Match <link rel="canonical" href="..."> in any attribute order
    const block = html.match(/<link[^>]*>/gi) ?? [];
    for (const tag of block) {
      if (relRegex.test(tag)) {
        const href = tag.match(/href=["']([^"']+)["']/i);
        if (href) return href[1].trim();
      }
    }
    return null;
  }

  private _extractStructuredData(html: string): StructuredDataResult[] {
    const results: StructuredDataResult[] = [];
    const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

    let match: RegExpExecArray | null;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        const type = data['@type'] ?? 'Unknown';
        const issues: string[] = this._validateSchema(type, data);
        results.push({ type, valid: issues.length === 0, issues, data });
      } catch {
        results.push({
          type: 'ParseError',
          valid: false,
          issues: ['Invalid JSON-LD — could not parse structured data block'],
          data: {},
        });
      }
    }

    return results;
  }

  private _validateSchema(type: string, data: Record<string, any>): string[] {
    const issues: string[] = [];

    if (!data['@context']) issues.push('Missing @context');

    switch (type) {
      case 'Product':
        if (!data.name) issues.push('Product: missing name');
        if (!data.description) issues.push('Product: missing description');
        if (!data.offers) issues.push('Product: missing offers');
        break;
      case 'Organization':
        if (!data.name) issues.push('Organization: missing name');
        if (!data.url) issues.push('Organization: missing url');
        break;
      case 'BreadcrumbList':
        if (!data.itemListElement?.length) issues.push('BreadcrumbList: no items');
        break;
      case 'WebSite':
        if (!data.url) issues.push('WebSite: missing url');
        break;
    }

    return issues;
  }
}
