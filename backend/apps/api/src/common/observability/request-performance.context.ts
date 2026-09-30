import { AsyncLocalStorage } from 'async_hooks';
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service';

export interface PerformanceDiagnostics {
  requestId: string;
  route: string;
  operation: string;
  method: string;
  statusCode?: number;
  totalDurationMs: number;
  authDurationMs: number;
  authorizationDurationMs: number;
  redisDurationMs: number;
  redisQueryCount: number;
  databaseDurationMs: number;
  databaseQueryCount: number;
  externalServiceDurationMs: number;
  serializationDurationMs: number;
  isColdStart?: boolean;
}

export class RequestPerformanceContext {
  private static readonly storage = new AsyncLocalStorage<RequestPerformanceContext>();
  private static readonly logger = new StructuredLogger('PerformanceTelemetry');
  private static readonly SLOW_THRESHOLD_MS = Number(process.env.SLOW_REQUEST_THRESHOLD_MS || 500);

  public readonly requestId: string;
  public route: string;
  public operation: string;
  public method: string;
  public statusCode?: number;
  public readonly startTime: number;

  public authDurationMs = 0;
  public authorizationDurationMs = 0;
  public redisDurationMs = 0;
  public redisQueryCount = 0;
  public databaseDurationMs = 0;
  public databaseQueryCount = 0;
  public externalServiceDurationMs = 0;
  public serializationDurationMs = 0;

  constructor(route: string, operation: string, method: string, requestId?: string) {
    this.requestId = requestId || `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    this.route = route;
    this.operation = operation;
    this.method = method;
    this.startTime = performance.now();
  }

  static run<T>(context: RequestPerformanceContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  static current(): RequestPerformanceContext | undefined {
    return this.storage.getStore();
  }

  recordAuth(durationMs: number) {
    this.authDurationMs += durationMs;
  }

  recordAuthorization(durationMs: number) {
    this.authorizationDurationMs += durationMs;
  }

  recordDb(durationMs: number) {
    this.databaseDurationMs += durationMs;
    this.databaseQueryCount += 1;
  }

  recordRedis(durationMs: number) {
    this.redisDurationMs += durationMs;
    this.redisQueryCount += 1;
  }

  recordExternal(durationMs: number) {
    this.externalServiceDurationMs += durationMs;
  }

  recordSerialization(durationMs: number) {
    this.serializationDurationMs += durationMs;
  }

  getDiagnostics(): PerformanceDiagnostics {
    const totalDurationMs = Math.round((performance.now() - this.startTime) * 100) / 100;
    return {
      requestId: this.requestId,
      route: this.route,
      operation: this.operation,
      method: this.method,
      statusCode: this.statusCode,
      totalDurationMs,
      authDurationMs: Math.round(this.authDurationMs * 100) / 100,
      authorizationDurationMs: Math.round(this.authorizationDurationMs * 100) / 100,
      redisDurationMs: Math.round(this.redisDurationMs * 100) / 100,
      redisQueryCount: this.redisQueryCount,
      databaseDurationMs: Math.round(this.databaseDurationMs * 100) / 100,
      databaseQueryCount: this.databaseQueryCount,
      externalServiceDurationMs: Math.round(this.externalServiceDurationMs * 100) / 100,
      serializationDurationMs: Math.round(this.serializationDurationMs * 100) / 100,
    };
  }

  finalize(res?: any) {
    const diag = this.getDiagnostics();

    // Attach W3C Server-Timing header if response object exists
    if (res && typeof res.setHeader === 'function') {
      try {
        const serverTiming = [
          `total;dur=${diag.totalDurationMs}`,
          `auth;dur=${diag.authDurationMs}`,
          `db;dur=${diag.databaseDurationMs};desc="${diag.databaseQueryCount} queries"`,
          `redis;dur=${diag.redisDurationMs};desc="${diag.redisQueryCount} queries"`,
        ].join(', ');
        res.setHeader('Server-Timing', serverTiming);
        res.setHeader('X-Request-Id', diag.requestId);
      } catch {
        // Ignore if headers already sent
      }
    }

    if (diag.totalDurationMs >= RequestPerformanceContext.SLOW_THRESHOLD_MS) {
      RequestPerformanceContext.logger.warn({
        message: `SLOW API REQUEST DETECTED: [${diag.method}] ${diag.route} took ${diag.totalDurationMs}ms (threshold: ${RequestPerformanceContext.SLOW_THRESHOLD_MS}ms)`,
        ...diag,
      });
    } else {
      RequestPerformanceContext.logger.debug({
        message: `API REQUEST: [${diag.method}] ${diag.route} completed in ${diag.totalDurationMs}ms`,
        ...diag,
      });
    }
  }
}
