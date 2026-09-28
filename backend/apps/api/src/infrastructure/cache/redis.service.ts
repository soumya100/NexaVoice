import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { StructuredLogger } from '../observability/structured-logger.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;
  private readonly logger = new StructuredLogger('RedisService');
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    let host = this.configService.get<string>('redis.host', 'localhost');
    const port = this.configService.get<number>('redis.port', 6379);
    const password = this.configService.get<string | undefined>('redis.password');
    const db = this.configService.get<number>('redis.db', 0);
    const redisUrl = process.env.REDIS_URL;

    try {
      const retryStrategy = (times: number) => {
        if (times > 3) {
          return null; // Stop retrying after 3 attempts during init to avoid hanging
        }
        return Math.min(times * 100, 1000);
      };

      if (redisUrl || host.includes('redis://') || host.includes('rediss://')) {
        let rawUrl = redisUrl || host;
        // If user pasted command like: redis-cli --tls -u redis://...
        const match = rawUrl.match(/(rediss?:\/\/[^\s]+)/);
        if (match) {
          rawUrl = match[1];
        }
        // Ensure Upstash connections use TLS (rediss://)
        if (rawUrl.includes('upstash.io') && rawUrl.startsWith('redis://')) {
          rawUrl = rawUrl.replace('redis://', 'rediss://');
        }
        this.client = new Redis(rawUrl, {
          retryStrategy,
          lazyConnect: true,
        });
      } else {
        this.client = new Redis({
          host,
          port,
          password,
          db,
          retryStrategy,
          lazyConnect: true,
        });
      }

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Redis connected successfully');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.warn(`Redis connection error: ${err.message}`);
      });

      this.client.connect().catch((err) => {
        this.isConnected = false;
        this.logger.warn(`Initial Redis connection could not be established: ${err.message}`);
      });
    } catch (err) {
      this.isConnected = false;
      this.logger.warn(`Failed to initialize Redis client: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => {});
      this.logger.log('Redis client closed');
    }
  }

  isRedisConnected(): boolean {
    return this.isConnected;
  }

  async ping(): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }
    try {
      const res = await this.client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !this.isConnected) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client || !this.isConnected) return;
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.isConnected) return;
    await this.client.del(key);
  }
}
