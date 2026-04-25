import { Injectable, NestInterceptor, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponseDto } from '../dto/api-response.dto';

@Injectable()
export class ResponseNormalizerInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: any): Observable<any> {
    return next.handle().pipe(
      map((value: any) => {
        if (value instanceof ApiResponseDto) return value;
        // Already a shaped envelope (success field present)
        if (value && typeof value === 'object' && 'success' in value) return value;
        return ApiResponseDto.success('OK', value);
      }),
    );
  }
}
