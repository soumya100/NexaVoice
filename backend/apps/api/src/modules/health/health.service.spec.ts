import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { SignalingGateway } from '../realtime/signaling.gateway';

describe('HealthService', () => {
  let service: HealthService;
  let mockPrisma: Partial<PrismaService>;
  let mockRedis: Partial<RedisService>;
  let mockSignaling: Partial<SignalingGateway>;
  let mockConfig: Partial<ConfigService>;

  beforeEach(async () => {
    mockPrisma = {
      ping: jest.fn().mockResolvedValue(true),
    };

    mockRedis = {
      ping: jest.fn().mockResolvedValue(true),
    };

    mockSignaling = {
      getActiveClientCount: jest.fn().mockReturnValue(2),
    };

    mockConfig = {
      get: jest.fn().mockReturnValue('test'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: SignalingGateway, useValue: mockSignaling },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should report liveness status as ok', () => {
    const liveness = service.isLivenessOk();
    expect(liveness.status).toBe('ok');
    expect(typeof liveness.uptime).toBe('number');
  });

  it('should report all services healthy when ping succeeds', async () => {
    const health = await service.checkHealth();
    expect(health.status).toBe('ok');
    expect(health.services.database.status).toBe('up');
    expect(health.services.redis.status).toBe('up');
    expect(health.services.signaling.status).toBe('up');
  });

  it('should report degraded status when database is down', async () => {
    (mockPrisma.ping as jest.Mock).mockResolvedValue(false);

    const health = await service.checkHealth();
    expect(health.status).toBe('degraded');
    expect(health.services.database.status).toBe('down');
    expect(health.services.redis.status).toBe('up');
  });
});
