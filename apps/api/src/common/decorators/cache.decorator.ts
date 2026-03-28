import { SetMetadata } from '@nestjs/common';

export interface CacheOptions {
  ttlSeconds: number;
  keyPrefix?: string;
}

/**
 * Marks an endpoint as cacheable
 *
 * Usage:
 * @Get('categories')
 * @Cacheable({ ttlSeconds: 24 * 60 * 60 })
 * async getCategories() { }
 */
export const Cacheable = (options: CacheOptions) =>
  SetMetadata('cacheable', options);
