import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

const SAMPLE_WINDOW = 100; // samples kept per route
const SLOW_P95_THRESHOLD_MS = 500;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');
  // route key → sorted ring of durations (ms)
  private readonly samples = new Map<string, number[]>();

  intercept(context: ExecutionContext, next: any): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const key = `${req.method}:${req.route?.path ?? req.url}`;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.record(key, duration);

        const bucket = this.samples.get(key)!;
        if (bucket.length >= 10) {
          const p95 = percentile(bucket, 95);
          const p99 = percentile(bucket, 99);
          if (duration > SLOW_P95_THRESHOLD_MS || duration > p95) {
            this.logger.warn(
              `SLOW ${key} | current=${duration}ms p95=${p95}ms p99=${p99}ms n=${bucket.length}`,
            );
          }
        }
      }),
    );
  }

  private record(key: string, duration: number) {
    if (!this.samples.has(key)) this.samples.set(key, []);
    const bucket = this.samples.get(key)!;
    bucket.push(duration);
    if (bucket.length > SAMPLE_WINDOW) bucket.shift();
    bucket.sort((a, b) => a - b);
  }

  /** Expose snapshot for a health/debug endpoint if needed */
  getSnapshot(): Record<string, { p95: number; p99: number; n: number }> {
    const out: Record<string, { p95: number; p99: number; n: number }> = {};
    for (const [key, bucket] of this.samples) {
      out[key] = {
        p95: percentile(bucket, 95),
        p99: percentile(bucket, 99),
        n: bucket.length,
      };
    }
    return out;
  }
}
