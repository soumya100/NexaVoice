import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RequestPerformanceContext } from '../observability/request-performance.context';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const type = context.getType<'http' | 'ws' | 'graphql'>();

    if (type === 'http') {
      const request = context.switchToHttp().getRequest();
      const response = context.switchToHttp().getResponse();
      const method = request.method;
      const url = request.url;

      const perfCtx = new RequestPerformanceContext(
        url,
        request.body?.operationName || method,
        method,
        request.headers['x-request-id'],
      );
      request._perf = perfCtx;

      return new Observable((subscriber) => {
        RequestPerformanceContext.run(perfCtx, () => {
          next
            .handle()
            .pipe(
              tap({
                next: () => {
                  perfCtx.statusCode = response.statusCode;
                  perfCtx.finalize(response);
                },
                error: (err) => {
                  perfCtx.statusCode = err.status || 500;
                  perfCtx.finalize(response);
                },
              }),
            )
            .subscribe(subscriber);
        });
      });
    }

    return next.handle();
  }
}
