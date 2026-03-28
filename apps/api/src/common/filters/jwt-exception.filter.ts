import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { ApiResponseDto } from '../dto/api-response.dto';

@Catch(UnauthorizedException)
export class JwtExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(JwtExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let code = 'UNAUTHORIZED';
    let message = 'You are not authorized to access this resource.';

    // Check if it's a JWT error
    if (exception instanceof TokenExpiredError) {
      code = 'TOKEN_EXPIRED';
      message = 'Your session has expired. Please log in again.';
    } else if (exception instanceof JsonWebTokenError) {
      code = 'INVALID_TOKEN';
      message = 'Invalid authentication token. Please log in again.';
    } else if (exception.message && exception.message.includes('jwt')) {
      if (exception.message.includes('expired')) {
        code = 'TOKEN_EXPIRED';
        message = 'Your session has expired. Please log in again.';
      } else if (exception.message.includes('malformed')) {
        code = 'INVALID_TOKEN';
        message = 'The authentication token is invalid.';
      } else {
        code = 'INVALID_TOKEN';
        message = 'Authentication failed. Please log in again.';
      }
    } else {
      message = exception.message || 'Unauthorized access.';
    }

    this.logger.warn('JWT Exception:', {
      code,
      message: exception.message,
      path: request.url,
      method: request.method,
      ip: request.ip,
      timestamp: new Date().toISOString(),
    });

    const errorResponse = ApiResponseDto.error(code, message);
    response.status(401).json(errorResponse);
  }
}
