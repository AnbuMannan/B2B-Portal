import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { RedisService } from '../../services/redis/redis.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestIdInterceptor.name);

  constructor(private readonly redisService: RedisService) {}

  async intercept(
    context: ExecutionContext,
    next: any,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Step 1: Get or create request ID
    let requestId = request.headers['x-request-id'] as string;
    if (!requestId) {
      requestId = uuidv4();
    }

    // Step 2: Attach to request for use in services
    (request as any).requestId = requestId;
    (request as any).idempotencyKey = requestId;

    // Step 3: Add to response headers
    response.setHeader('X-Request-ID', requestId);

    // Step 4: Check if this is a financial mutation requiring idempotency
    const isFinancialMutation = this.isFinancialEndpoint(
      request.path,
      request.method,
    );

    if (isFinancialMutation) {
      // Check if request was already processed (idempotent retry)
      const cacheKey = `idempotent:${requestId}`;
      try {
        const cachedResult = await this.redisService.get<any>(cacheKey);

        if (cachedResult) {
          this.logger.warn(
            `⚠️  Idempotent retry detected: ${requestId} - Returning cached result`,
          );
          this.logger.log(
            `Preventing duplicate ${request.method} ${request.path} operation`,
          );

          // Return cached result immediately (prevent duplicate processing)
          return of(cachedResult);
        }
      } catch (error) {
        this.logger.error(`Idempotency check failed for ${requestId}: ${error.message}`);
        // Continue normally - idempotency is best-effort to avoid blocking transactions
      }
    }

    // Step 5: Process request normally
    return next.handle().pipe(
      tap(async (result: any) => {
        // Step 6: Cache result for idempotency (24 hours)
        if (isFinancialMutation && result) {
          const cacheKey = `idempotent:${requestId}`;
          const ttlSeconds = 24 * 60 * 60; // 24 hours

          try {
            await this.redisService.set(cacheKey, result, ttlSeconds);
            this.logger.log(
              `✅ Cached idempotent result: ${requestId} (TTL: 24h)`,
            );
          } catch (error) {
            this.logger.error(
              `Failed to cache idempotent result: ${error}`,
            );
          }
        }
      }),
      catchError((error: any) => {
        // Don't cache errors - let them be retried
        this.logger.error(
          `Operation failed: ${request.method} ${request.path} (${requestId})`,
          error.message,
        );
        throw error;
      }),
    );
  }

  private isFinancialEndpoint(path: string, method: string): boolean {
    // Only POST, PUT, PATCH, DELETE operations require idempotency
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return false;
    }

    // Financial operation patterns
    const financialPatterns = [
      /\/api\/payment\/.*/,
      /\/api\/payments\/.*/,
      /\/api\/seller\/recharge.*/,
      /\/api\/lead-credit\/.*/,
      /\/api\/lead-credits\/.*/,
      /\/api\/refund\/.*/,
      /\/api\/refunds\/.*/,
      /\/api\/order\/.*/,
      /\/api\/orders\/.*/,
      /\/api\/wallet\/.*/,
      /\/api\/credit\/.*/,
    ];

    return financialPatterns.some((pattern) => pattern.test(path));
  }
}
