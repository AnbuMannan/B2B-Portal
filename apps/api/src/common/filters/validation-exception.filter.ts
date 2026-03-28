import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiResponseDto } from '../dto/api-response.dto';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    // Extract field errors from class-validator
    let fieldErrors: Record<string, string[]> = {};
    
    if (exceptionResponse.message) {
      if (Array.isArray(exceptionResponse.message)) {
        // class-validator array format
        exceptionResponse.message.forEach((err: any) => {
          if (err.constraints) {
            fieldErrors[err.property] = Object.values(err.constraints);
          }
        });
      } else if (typeof exceptionResponse.message === 'string') {
        // Single error message
        fieldErrors['general'] = [exceptionResponse.message];
      }
    }

    const errorResponse = ApiResponseDto.error(
      'Validation failed. Please check the error details.',
      fieldErrors,
      status
    );

    this.logger.warn('Validation Error:', {
      path: request.url,
      method: request.method,
      ip: request.ip,
      errors: fieldErrors,
      timestamp: new Date().toISOString(),
    });

    response.status(status).json(errorResponse);
  }
}
