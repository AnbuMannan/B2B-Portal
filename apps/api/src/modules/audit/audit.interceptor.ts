import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { AuditService } from './audit.service';
import { Reflector } from '@nestjs/core';
import { AuditableOptions } from './audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private auditService: AuditService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: any): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, ip } = request;

    // Only audit mutations (POST, PUT, PATCH, DELETE)
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (!isMutation) {
      return next.handle();
    }

    // Get audit metadata from decorator
    const auditOptions = this.reflector.get<AuditableOptions>(
      'auditable',
      context.getHandler(),
    );

    const user = (request as any).user;
    const userAgent = request.get('user-agent');

    return next.handle().pipe(
      tap(async (result: any) => {
        // Log the action after successful execution
        if (auditOptions) {
          try {
            // Extract ID from result or route params
            const entityId = this.extractEntityId(
              auditOptions.entity,
              result,
              request.params,
            );

            await this.auditService.logAction({
              userId: user?.id,
              entityType: auditOptions.entity,
              entityId,
              action: auditOptions.action,
              newValue: this.sanitize(result),
              ipAddress: ip,
              userAgent,
            });
          } catch (error) {
            this.logger.error(
              `Failed to audit ${auditOptions.action} ${auditOptions.entity}`,
              error,
            );
          }
        }
      }),
      catchError((error: any) => {
        // Log failed mutations too (for fraud detection)
        if (auditOptions) {
          try {
            this.auditService.logAction({
              userId: user?.id,
              entityType: auditOptions.entity,
              entityId: request.params.id || 'unknown',
              action: auditOptions.action,
              newValue: { error: error.message },
              ipAddress: ip,
              userAgent,
            });
          } catch (auditError) {
            this.logger.error('Failed to audit error', auditError);
          }
        }
        throw error;
      }),
    );
  }

  private extractEntityId(
    entityType: string,
    result: any,
    params: any,
  ): string {
    // Try to get ID from result first
    if (result?.id) return result.id;
    if (result?.data?.id) return result.data.id;

    // Fall back to route params
    if (params.id) return params.id;
    if (params[`${entityType.toLowerCase()}Id`])
      return params[`${entityType.toLowerCase()}Id`];

    return 'unknown';
  }

  private sanitize(data: any): any {
    // Remove sensitive fields before storing
    const sensitiveFields = [
      'password',
      'token',
      'authorization',
      'creditCard',
      'cvv',
    ];

    if (!data || typeof data !== 'object') return data;

    const sanitized = JSON.parse(JSON.stringify(data));

    const removeSensitive = (obj: any) => {
      for (const key in obj) {
        if (sensitiveFields.some((f) => key.toLowerCase().includes(f))) {
          obj[key] = '***REDACTED***';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          removeSensitive(obj[key]);
        }
      }
    };

    removeSensitive(sanitized);
    return sanitized;
  }
}
