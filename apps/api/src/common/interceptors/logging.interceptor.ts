import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);
  private winstonLogger: winston.Logger;

  constructor() {
    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Configure Winston logger
    this.winstonLogger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json(),
      ),
      defaultMeta: {
        service: 'b2b-marketplace',
        environment: process.env.NODE_ENV || 'development',
      },
      transports: [
        // Console transport for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(
              ({ timestamp, level, message, ...meta }) =>
                `${timestamp} [${level}] ${message} ${
                  Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
                }`,
            ),
          ),
        }),
        // File transport for all logs
        new winston.transports.File({
          filename: path.join('logs', 'combined.log'),
          maxsize: 10485760, // 10MB
          maxFiles: 10,
        }),
        // Separate file for errors
        new winston.transports.File({
          filename: path.join('logs', 'error.log'),
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 10,
        }),
      ],
    });
  }

  intercept(context: ExecutionContext, next: any): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Use requestId set by RequestIdInterceptor or generate one if not present
    const requestId = (request as any).requestId || this.getOrCreateRequestId(request);
    const startTime = Date.now();
    const { method, url, ip } = request;

    // Log incoming request
    this.winstonLogger.info('Incoming Request', {
      type: 'REQUEST',
      requestId,
      method,
      url,
      query: request.query,
      body: this.sanitizeData(request.body),
      headers: this.sanitizeHeaders(request.headers),
      ip,
      userAgent: request.get('user-agent'),
      timestamp: new Date().toISOString(),
    });

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        
        this.winstonLogger.info('Outgoing Response', {
          type: 'RESPONSE',
          requestId,
          method,
          url,
          statusCode: response.statusCode,
          duration: `${duration}ms`,
          durationMs: duration,
          ip,
          timestamp: new Date().toISOString(),
        });

        // Warn if response time is slow
        if (duration > 1000) {
          this.logger.warn(
            `Slow endpoint detected: ${method} ${url} took ${duration}ms`,
          );
        }
      }),
      catchError((error: any) => {
        const duration = Date.now() - startTime;
        
        this.winstonLogger.error('Request Error', {
          type: 'ERROR',
          requestId,
          method,
          url,
          statusCode: error.status || 500,
          error: error.message,
          stack: error.stack,
          duration: `${duration}ms`,
          durationMs: duration,
          ip,
          timestamp: new Date().toISOString(),
        });

        throw error;
      }),
    );
  }

  private getOrCreateRequestId(request: any): string {
    let requestId = request.headers['x-request-id'];
    
    if (!requestId) {
      // Generate new request ID if not provided
      requestId = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 11)}`;
      request.headers['x-request-id'] = requestId;
    }

    return requestId;
  }

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'password',
      'token',
      'authorization',
      'panNumber',
      'pan',
      'aadhaar',
      'gstNumber',
      'gstin',
      'phoneNumber',
      'phone',
      'email',
      'creditCard',
      'cvv',
      'accessToken',
      'refreshToken',
      'apiKey',
      'secret',
    ];

    const sanitized = JSON.parse(JSON.stringify(data));

    const sanitizeSensitive = (obj: any) => {
      for (const key in obj) {
        if (
          sensitiveFields.some((field) =>
            key.toLowerCase().includes(field.toLowerCase()),
          )
        ) {
          obj[key] = '***SANITIZED***';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeSensitive(obj[key]);
        }
      }
    };

    sanitizeSensitive(sanitized);
    return sanitized;
  }

  private sanitizeHeaders(headers: any): any {
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-auth-token',
      'x-api-key',
      'authentication',
      'x-access-token',
    ];

    const sanitized = { ...headers };

    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = '***SANITIZED***';
      }
    });

    return sanitized;
  }
}
