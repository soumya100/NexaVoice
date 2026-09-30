import { Injectable, Optional, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { StructuredLogger } from '../observability/structured-logger.service';
import { RequestPerformanceContext } from '../../common/observability/request-performance.context';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new StructuredLogger('PrismaService');
  private isConnected = false;

  constructor(@Optional() configService?: ConfigService) {
    const dbUrl =
      configService?.get<string>('database.url') ||
      process.env.DATABASE_URL;
    super(dbUrl ? { datasources: { db: { url: dbUrl } } } : undefined);

    // Instrument database execution time and query counting
    if (typeof (this as any).$use === 'function') {
      (this as any).$use(async (params: any, next: (params: any) => Promise<any>) => {
        const before = performance.now();
        const result = await next(params);
        const duration = performance.now() - before;
        const perfCtx = RequestPerformanceContext.current();
        if (perfCtx) {
          perfCtx.recordDb(duration);
        }
        return result;
      });
    }
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.isConnected = true;
      this.logger.log('Database connected successfully');
    } catch (err) {
      this.isConnected = false;
      this.logger.warn({
        message: 'Could not connect to database at startup; will retry on demand.',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.$disconnect();
      this.logger.log('Database disconnected successfully');
    }
  }

  isDatabaseConnected(): boolean {
    return this.isConnected;
  }

  async ping(): Promise<boolean> {
    try {
      await this.$queryRawUnsafe('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
