import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../services/redis/redis.service';

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(private redisService: RedisService) {}

  /**
   * Invalidate caches when a product is created/updated/deleted
   */
  async invalidateProductCaches(productId?: string): Promise<void> {
    try {
      // Invalidate products list
      await this.redisService.delete('cache:GET:/api/products');

      // Invalidate categories (as they might contain product counts)
      await this.redisService.delete('cache:GET:/api/categories');

      // Invalidate specific product detail
      if (productId) {
        await this.redisService.delete(
          `cache:GET:/api/products/${productId}`,
        );
      }

      this.logger.log(`✅ Product caches invalidated`);
    } catch (error) {
      this.logger.warn(`Failed to invalidate product caches: ${error.message}`);
    }
  }

  /**
   * Invalidate seller-related caches
   */
  async invalidateSellerCaches(sellerId?: string): Promise<void> {
    try {
      await this.redisService.delete('cache:GET:/api/seller');

      if (sellerId) {
        await this.redisService.delete(
          `cache:GET:/api/seller/${sellerId}`,
        );
      }

      this.logger.log(`✅ Seller caches invalidated`);
    } catch (error) {
      this.logger.warn(`Failed to invalidate seller caches: ${error.message}`);
    }
  }

  /**
   * Invalidate all caches (nuclear option)
   */
  async invalidateAllCaches(): Promise<void> {
    try {
      // Get all cache keys
      const keys = await this.redisService.getKeys('cache:*');

      if (keys && keys.length > 0) {
        for (const key of keys) {
          await this.redisService.delete(key);
        }
      }

      this.logger.log(`✅ All caches invalidated (${keys?.length || 0} keys)`);
    } catch (error) {
      this.logger.warn(`Failed to invalidate all caches: ${error.message}`);
    }
  }
}
