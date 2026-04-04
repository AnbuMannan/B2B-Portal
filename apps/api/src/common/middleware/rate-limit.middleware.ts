import { Injectable, Logger } from '@nestjs/common';
import { NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../services/redis/redis.service';

interface RateLimitRule {
  maxRequests: number;
  windowSeconds: number;
}

interface RateLimitConfig {
  [key: string]: RateLimitRule;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);

  // Rate limit rules by endpoint
  private readonly rules: RateLimitConfig = {
    '/api/auth/login': { maxRequests: 5, windowSeconds: 900 }, // 5/15 min
    '/api/auth/register': { maxRequests: 5, windowSeconds: 900 }, // 5/15 min
    '/api/auth/forgot-password': { maxRequests: 3, windowSeconds: 3600 }, // 3/hour
    '/api/payment': { maxRequests: 5, windowSeconds: 300 }, // 5/5 min
    '/api/seller/recharge': { maxRequests: 5, windowSeconds: 300 }, // 5/5 min
    '/api/refund': { maxRequests: 3, windowSeconds: 300 }, // 3/5 min
    '/api/search': { maxRequests: 30, windowSeconds: 60 },   // 30 searches/min per IP
    '/api/upload': { maxRequests: 10, windowSeconds: 3600 }, // 10/hour
    'DEFAULT': { maxRequests: 100, windowSeconds: 60 }, // 100/min
  };

  constructor(private redisService: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (!this.redisService.isAvailable()) {
      return next();
    }

    try {
      const ip = this.getClientIp(req);
      const endpoint = this.getEndpoint(req.path);
      const rule = this.rules[endpoint] || this.rules['DEFAULT'];

      const isAllowed = await this.checkRateLimit(
        ip,
        endpoint,
        rule.maxRequests,
        rule.windowSeconds,
      );

      if (!isAllowed) {
        this.logger.warn(`Rate limit exceeded: IP ${ip} on ${endpoint}`);

        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many requests. Maximum ${rule.maxRequests} requests per ${rule.windowSeconds} seconds allowed.`,
            retryAfter: rule.windowSeconds,
          },
          timestamp: new Date().toISOString(),
        });

        return;
      }

      res.setHeader('X-RateLimit-Limit', rule.maxRequests.toString());
      res.setHeader('X-RateLimit-Window', rule.windowSeconds.toString());
      next();
    } catch (error) {
      this.logger.error('Rate limit check failed', error);
      next();
    }
  }

  /**
   * Check if request is within rate limit
   * Returns true if allowed, false if limit exceeded
   */
  private async checkRateLimit(
    ip: string,
    endpoint: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<boolean> {
    const key = `rate-limit:${ip}:${endpoint}`;

    try {
      // Get current count
      const current = await this.redisService.incr(key);

      // First request in window - set expiry
      if (current === 1) {
        // Set expiry to window duration
        await this.redisService.expire(key, windowSeconds);
      }

      // Check if limit exceeded
      return current <= maxRequests;
    } catch (error) {
      this.logger.error(`Rate limit check error: ${error}`);
      return true; // Allow on error
    }
  }

  /**
   * Get client IP address (handles proxies)
   */
  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = typeof forwarded === 'string'
        ? forwarded.split(',')
        : forwarded;
      return ips[0].trim();
    }

    return req.ip || (req.socket as any).remoteAddress || 'unknown';
  }

  /**
   * Get endpoint for rate limiting (group similar paths)
   */
  private getEndpoint(path: string): string {
    // Exact matches for critical endpoints
    for (const rule in this.rules) {
      if (rule !== 'DEFAULT' && path.startsWith(rule)) {
        return rule;
      }
    }

    // Default for everything else
    return 'DEFAULT';
  }
}
