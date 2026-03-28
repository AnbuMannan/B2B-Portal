import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponseDto } from '../dto/api-response.dto';

@Catch()
export class BaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(BaseExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let details: any = null;

    // Handle NestJS HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object') {
        const objResponse = exceptionResponse as any;
        message = objResponse.message || exception.message;
        code = objResponse.code || this.mapStatusToCode(status);
        details = objResponse.details;
      } else {
        message = exceptionResponse.toString();
        code = this.mapStatusToCode(status);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      code = 'INTERNAL_SERVER_ERROR';
      this.logger.error('Unhandled Error:', {
        message: exception.message,
        stack: exception.stack,
        path: request.url,
        method: request.method,
      });
    } else {
      message = 'An unexpected error occurred';
      this.logger.error('Unknown Exception:', exception);
    }

    const errorResponse = ApiResponseDto.error(code, message, details);

    this.logger.error('Exception Caught:', {
      status,
      code,
      message,
      path: request.url,
      method: request.method,
      ip: request.ip,
      timestamp: new Date().toISOString(),
    });

    response.status(status).json(errorResponse);
  }

  private mapStatusToCode(status: number): string {
    const statusCodeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };
    return statusCodeMap[status] || 'INTERNAL_SERVER_ERROR';
  }
}
