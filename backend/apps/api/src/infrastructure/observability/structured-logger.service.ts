import { Injectable, LoggerService, LogLevel } from '@nestjs/common';

@Injectable()
export class StructuredLogger implements LoggerService {
  private readonly context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  log(message: unknown, context?: string) {
    this.printLog('info', message, context);
  }

  error(message: unknown, trace?: string, context?: string) {
    this.printLog('error', message, context, { trace });
  }

  warn(message: unknown, context?: string) {
    this.printLog('warn', message, context);
  }

  debug(message: unknown, context?: string) {
    this.printLog('debug', message, context);
  }

  verbose(message: unknown, context?: string) {
    this.printLog('verbose', message, context);
  }

  private printLog(
    level: LogLevel | 'info',
    message: unknown,
    context?: string,
    extraMeta?: Record<string, unknown>,
  ) {
    const logObject = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      context: context || this.context || 'Application',
      message: typeof message === 'object' ? message : String(message),
      ...extraMeta,
    };

    if (level === 'error') {
      console.error(JSON.stringify(logObject));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(logObject));
    } else {
      console.log(JSON.stringify(logObject));
    }
  }
}
