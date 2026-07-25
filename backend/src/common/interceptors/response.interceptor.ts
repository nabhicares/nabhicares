import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseEnvelope<T> {
  success: boolean;
  data: T;
  meta?: any;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ResponseEnvelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ResponseEnvelope<T>> {
    return next.handle().pipe(
      map((data) => {
        // If data is already in response envelope, pass it through
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // If the data payload contains pagination metadata, pull it to the root level
        if (data && typeof data === 'object' && 'items' in data && 'meta' in data) {
          return {
            success: true,
            data: data.items,
            meta: data.meta,
          };
        }

        return {
          success: true,
          data: data === undefined ? null : data,
        };
      }),
    );
  }
}
