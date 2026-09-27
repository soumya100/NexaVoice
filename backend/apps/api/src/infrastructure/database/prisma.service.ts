import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { StructuredLogger } from '../observability/structured-logger.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new StructuredLogger('PrismaService');
  private isConnected = false;

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
