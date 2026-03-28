import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiResponseDto } from '../dto/api-response.dto';

@Catch()
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    // Check if it's a Prisma error
    if (exception.code && exception.code.startsWith('P')) {
      let message = 'Database error occurred';
      let code = 'DATABASE_ERROR';
      let statusCode = 400;

      switch (exception.code) {
        case 'P2002': // Unique constraint violation
          code = 'DUPLICATE_ENTRY';
          const target = exception.meta?.target ? exception.meta.target.join(', ') : 'unknown field';
          message = `This ${target} is already in use. Please choose another.`;
          break;
        case 'P2025': // Record not found
          code = 'NOT_FOUND';
          message = 'The requested resource was not found.';
          statusCode = 404;
          break;
        case 'P2014': // Required relation violation
          code = 'INVALID_RELATION';
          message = 'Invalid relation reference. Related record does not exist.';
          break;
        case 'P2003': // Foreign key constraint violation
          code = 'FOREIGN_KEY_VIOLATION';
          message = 'Cannot perform this action because a related record is being referenced.';
          break;
        case 'P2000': // Value too long
          code = 'VALUE_TOO_LONG';
          message = 'The provided value is too long for this field.';
          break;
        case 'P2001': // Record required
          code = 'RECORD_REQUIRED';
          message = 'The required record does not exist.';
          break;
        default:
          code = 'DATABASE_ERROR';
          message = 'A database error occurred. Please try again later.';
          statusCode = 500;
      }

      this.logger.error('Prisma Error:', {
        code: exception.code,
        prismaMessage: exception.message,
        target: exception.meta?.target,
        path: request.url,
        timestamp: new Date().toISOString(),
      });

      const errorResponse = ApiResponseDto.error(code, message);
      response.status(statusCode).json(errorResponse);
    } else {
      // Generic database error (non-Prisma)
      this.logger.error('Database Exception:', {
        message: exception.message,
        stack: exception.stack,
        path: request.url,
        timestamp: new Date().toISOString(),
      });

      const errorResponse = ApiResponseDto.error(
        'DATABASE_ERROR',
        'A database error occurred. Please try again later.'
      );
      response.status(500).json(errorResponse);
    }
  }
}
