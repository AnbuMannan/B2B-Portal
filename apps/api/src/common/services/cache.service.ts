import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../services/redis/redis.service';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Return cached value if present; otherwise call factory, cache result, and return it.
   * Pass ttl=0 to cache without expiry.
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds: number): Promise<T> {
    const cached = await this.redis.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.redis.set(key, value, ttlSeconds || undefined);
    return value;
  }

  async invalidate(key: string): Promise<void> {
    await this.redis.delete(key);
  }

  async invalidateMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => this.redis.delete(k)));
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.getKeys(pattern);
    if (keys.length > 0) {
      await Promise.all(keys.map((k) => this.redis.delete(k)));
      this.logger.debug(`Invalidated ${keys.length} keys matching ${pattern}`);
    }
  }
}
