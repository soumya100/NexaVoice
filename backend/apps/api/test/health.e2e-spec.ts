import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { RedisService } from '../src/infrastructure/cache/redis.service';

jest.setTimeout(60000);

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mockPrisma = {
      ping: jest.fn().mockResolvedValue(true),
      isDatabaseConnected: jest.fn().mockReturnValue(true),
      onModuleInit: jest.fn().mockResolvedValue(undefined),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
      permission: { upsert: jest.fn().mockResolvedValue({}) },
      role: { upsert: jest.fn().mockResolvedValue({}) },
      rolePermission: { upsert: jest.fn().mockResolvedValue({}) },
    };

    const mockRedis = {
      ping: jest.fn().mockResolvedValue(true),
      isRedisConnected: jest.fn().mockReturnValue(true),
      onModuleInit: jest.fn().mockReturnValue(undefined),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(RedisService)
      .useValue(mockRedis)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/health/live (GET) returns 200 and ok status', () => {
    return request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(typeof res.body.uptime).toBe('number');
      });
  });

  it('/health/ready (GET) returns 200 with service health payload', () => {
    return request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.services.database.status).toBe('up');
        expect(res.body.services.redis.status).toBe('up');
        expect(res.body.services.signaling.status).toBe('up');
      });
  });

  it('/graphql (POST) executes health query successfully', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query {
            health {
              status
              timestamp
              uptimeSeconds
              services {
                database { status message }
                redis { status message }
                signaling { status message }
              }
            }
          }
        `,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toBeDefined();
        expect(res.body.data.health).toBeDefined();
        expect(res.body.data.health.status).toBe('ok');
        expect(res.body.data.health.services.database.status).toBe('up');
      });
  });
});
