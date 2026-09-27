import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new StructuredLogger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = Date.now();
    const type = context.getType<'http' | 'ws' | 'graphql'>();

    if (type === 'http') {
      const request = context.switchToHttp().getRequest();
      const method = request.method;
      const url = request.url;
      const ip = request.ip;

      return next.handle().pipe(
        tap(() => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          const duration = Date.now() - now;
          this.logger.log({
            method,
            url,
            statusCode,
            durationMs: duration,
            ip,
          });
        }),
      );
    }

    return next.handle();
  }
}
