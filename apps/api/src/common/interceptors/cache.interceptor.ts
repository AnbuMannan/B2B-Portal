import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { RedisService } from '../../services/redis/redis.service';

export interface CacheableOptions {
  ttlSeconds: number;
  keyPrefix?: string;
}

const DEFAULT_CACHE_TTL = 300; // 5 minutes

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  // Default TTLs by endpoint pattern
  private readonly defaultTTLs: Record<string, number> = {
    '/api/categories': 24 * 60 * 60, // 24 hours
    '/api/homepage': 60 * 60, // 1 hour
    '/api/products': 60 * 60, // 1 hour
    '/api/seller': 30 * 60, // 30 minutes
    '/api/buyer': 30 * 60, // 30 minutes
  };

  constructor(private redisService: RedisService) {}

  async intercept(
    context: ExecutionContext,
    next: any,
  ): Promise<Observable<any>> {
    if (!this.redisService.isAvailable()) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    // Build cache key
    const cacheKey = this.buildCacheKey(request);
    const ttl = this.getTTL(request.path);

    try {
      // Try to get from cache
      const cached = await this.redisService.get<any>(cacheKey);

      if (cached) {
        this.logger.debug(`Cache HIT: ${cacheKey}`);
        response.setHeader('X-Cache', 'HIT');
        return of(cached);
      }
    } catch (error) {
      this.logger.warn(`Cache read error: ${(error as Error).message}`);
      // Continue to handler on cache error
    }

    // Cache miss - execute handler and cache result
    this.logger.debug(`Cache MISS: ${cacheKey} (TTL: ${ttl}s)`);
    response.setHeader('X-Cache', 'MISS');

    return next.handle().pipe(
      tap(async (result: any) => {
        try {
          // Cache the response
          if (result) {
            await this.redisService.set<any>(cacheKey, result, ttl);
            this.logger.debug(`Cached: ${cacheKey} for ${ttl}s`);
          }
        } catch (error) {
          this.logger.warn(`Failed to cache: ${cacheKey} - ${(error as Error).message}`);
        }
      }),
    );
  }

  /**
   * Build cache key from request.
   * Includes method, path, query params, and user ID for uniqueness.
   * User ID is required so /api/seller/wallet doesn't serve user A's data to user B.
   */
  private buildCacheKey(request: Request): string {
    const { method, path, query } = request;

    // Build query string (sorted for consistency)
    const queryKeys = Object.keys(query).sort();
    const queryString = queryKeys
      .map((key) => `${key}=${query[key]}`)
      .join('&');

    // Include user ID for authenticated routes to prevent cross-user cache hits
    const userId = (request as any).user?.id;
    const userPart = userId ? `:u:${userId}` : '';

    return `cache:${method}:${path}${userPart}${queryString ? '?' + queryString : ''}`;
  }

  /**
   * Get TTL based on endpoint pattern
   */
  private getTTL(path: string): number {
    for (const pattern in this.defaultTTLs) {
      if (path.startsWith(pattern)) {
        return this.defaultTTLs[pattern];
      }
    }

    return DEFAULT_CACHE_TTL;
  }
}
