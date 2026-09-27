import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckResponse } from '@nexavoice/domain-types';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SignalingGateway } from '../realtime/signaling.gateway';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly signalingGateway: SignalingGateway,
  ) {}

  async checkHealth(): Promise<HealthCheckResponse> {
    const dbStart = Date.now();
    const dbOk = await this.prisma.ping();
    const dbLatency = Date.now() - dbStart;

    const redisStart = Date.now();
    const redisOk = await this.redis.ping();
    const redisLatency = Date.now() - redisStart;

    const signalingActive = true; // Gateway instantiated and listening

    const isHealthy = dbOk && redisOk;
    const isDegraded = !isHealthy && (dbOk || redisOk || signalingActive);

    const activeClients = this.signalingGateway.getActiveClientCount();

    return {
      status: isHealthy ? 'ok' : isDegraded ? 'degraded' : 'error',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      version: '0.1.0',
      environment: this.configService.get<string>('nodeEnv', 'development'),
      services: {
        database: {
          status: dbOk ? 'up' : 'down',
          message: dbOk ? 'PostgreSQL operational' : 'Database connection pending or offline',
          latencyMs: dbLatency,
        },
        redis: {
          status: redisOk ? 'up' : 'down',
          message: redisOk ? 'Redis cache operational' : 'Redis instance offline',
          latencyMs: redisLatency,
        },
        signaling: {
          status: signalingActive ? 'up' : 'down',
          message: `Signaling gateway active (${activeClients} connected clients)`,
          latencyMs: 0,
        },
      },
    };
  }

  isLivenessOk(): { status: string; uptime: number } {
    return {
      status: 'ok',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}
