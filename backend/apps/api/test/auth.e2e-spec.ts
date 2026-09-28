import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { RedisService } from '../src/infrastructure/cache/redis.service';
import { PasswordHasher } from '../src/common/security/password-hasher';
import { AccountState, SystemRole } from '@nexavoice/domain-types';

jest.setTimeout(60000);

describe('Authentication & Authorization (e2e)', () => {
  let app: INestApplication;

  // In-memory mock stores
  const usersDb = new Map<string, any>();
  const sessionsDb = new Map<string, any>();
  const devicesDb = new Map<string, any>();
  const refreshFamiliesDb = new Map<string, any>();
  const refreshTokensDb = new Map<string, any>();
  const securityEventsDb: any[] = [];

  beforeAll(async () => {
    // Pre-populate test user
    const preHashedPassword = await PasswordHasher.hash('validSecretPass123!');
    const preExistingUser = {
      id: 'mock-user-1',
      nexaVoiceId: 'NV-1234-5678',
      username: 'testuser',
      email: 'test@nexavoice.internal',
      displayName: 'Test User',
      passwordHash: preHashedPassword,
      status: 'ONLINE',
      accountState: AccountState.ACTIVE,
      isEmailVerified: true,
      isPhoneVerified: false,
      tokenVersion: 1,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    usersDb.set(preExistingUser.id, preExistingUser);

    const mockPrisma: any = {
      isDatabaseConnected: jest.fn().mockReturnValue(true),
      ping: jest.fn().mockResolvedValue(true),
      $transaction: jest.fn().mockImplementation(async (callbackOrOps) => {
        if (typeof callbackOrOps === 'function') {
          return callbackOrOps(mockPrisma);
        }
        return Promise.all(callbackOrOps);
      }),
      user: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          for (const u of usersDb.values()) {
            if (where.OR) {
              for (const condition of where.OR) {
                if (condition.username && u.username.toLowerCase() === condition.username.equals.toLowerCase()) {
                  return Promise.resolve(u);
                }
                if (condition.email && u.email && u.email.toLowerCase() === condition.email.equals.toLowerCase()) {
                  return Promise.resolve(u);
                }
                if (condition.nexaVoiceId && u.nexaVoiceId === condition.nexaVoiceId) {
                  return Promise.resolve(u);
                }
              }
            }
          }
          return Promise.resolve(null);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(usersDb.get(where.id) || null);
        }),
        findUniqueOrThrow: jest.fn().mockImplementation(({ where }) => {
          const u = usersDb.get(where.id);
          if (!u) throw new Error('User not found');
          return Promise.resolve(u);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const id = `user-${Date.now()}`;
          const newUser = {
            id,
            ...data,
            tokenVersion: 1,
            failedLoginAttempts: 0,
            isEmailVerified: false,
            isPhoneVerified: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          usersDb.set(id, newUser);
          return Promise.resolve(newUser);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const u = usersDb.get(where.id);
          if (u) {
            Object.assign(u, data);
          }
          return Promise.resolve(u);
        }),
      },
      session: {
        create: jest.fn().mockImplementation(({ data }) => {
          const id = `session-${Date.now()}-${Math.random()}`;
          const newSession = {
            id,
            ...data,
            isRevoked: false,
            createdAt: new Date(),
            lastActiveAt: new Date(),
          };
          sessionsDb.set(id, newSession);
          return Promise.resolve(newSession);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.replacedByTokenHash) {
            for (const s of sessionsDb.values()) {
              if (s.replacedByTokenHash === where.replacedByTokenHash) {
                return Promise.resolve(s);
              }
            }
          }
          return Promise.resolve(null);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id) return Promise.resolve(sessionsDb.get(where.id) || null);
          if (where.tokenHash) {
            for (const s of sessionsDb.values()) {
              if (s.tokenHash === where.tokenHash) return Promise.resolve(s);
            }
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const s = sessionsDb.get(where.id);
          if (s) Object.assign(s, data);
          return Promise.resolve(s);
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          const results = [];
          for (const s of sessionsDb.values()) {
            if (s.userId === where.userId && !s.isRevoked) {
              results.push(s);
            }
          }
          return Promise.resolve(results);
        }),
      },
      refreshTokenFamily: {
        create: jest.fn().mockImplementation(({ data }) => {
          const id = data.id || `family-${Date.now()}-${Math.random()}`;
          const fam = {
            id,
            sessionId: data.sessionId,
            createdAt: new Date(),
            revokedAt: null,
            revocationReason: null,
          };
          refreshFamiliesDb.set(id, fam);
          return Promise.resolve(fam);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const fam = refreshFamiliesDb.get(where.id);
          if (fam) Object.assign(fam, data);
          return Promise.resolve(fam);
        }),
        updateMany: jest.fn().mockImplementation(({ where, data }) => {
          let count = 0;
          for (const fam of refreshFamiliesDb.values()) {
            if (where.sessionId === fam.sessionId) {
              Object.assign(fam, data);
              count++;
            }
          }
          return Promise.resolve({ count });
        }),
      },
      refreshToken: {
        create: jest.fn().mockImplementation(({ data }) => {
          const id = data.id || `rt-${Date.now()}-${Math.random()}`;
          const token = {
            id,
            ...data,
            usedAt: null,
            replacedByTokenId: null,
            revokedAt: null,
          };
          refreshTokensDb.set(id, token);
          return Promise.resolve(token);
        }),
        findUnique: jest.fn().mockImplementation(({ where, include }) => {
          let found: any = null;
          if (where.id) found = refreshTokensDb.get(where.id);
          if (where.tokenHash) {
            for (const t of refreshTokensDb.values()) {
              if (t.tokenHash === where.tokenHash) {
                found = t;
                break;
              }
            }
          }
          if (found && include?.family) {
            const fam = refreshFamiliesDb.get(found.familyId);
            const famWithSession = fam
              ? {
                  ...fam,
                  session: sessionsDb.get(fam.sessionId) || null,
                }
              : null;
            return Promise.resolve({
              ...found,
              family: famWithSession,
            });
          }
          return Promise.resolve(found || null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const t = refreshTokensDb.get(where.id);
          if (t) Object.assign(t, data);
          return Promise.resolve(t);
        }),
        updateMany: jest.fn().mockImplementation(({ where, data }) => {
          let count = 0;
          for (const t of refreshTokensDb.values()) {
            if (where.familyId && t.familyId === where.familyId) {
              Object.assign(t, data);
              count++;
            }
          }
          return Promise.resolve({ count });
        }),
      },
      device: {
        upsert: jest.fn().mockImplementation(({ create }) => {
          const d = { id: `dev-${Date.now()}`, ...create };
          devicesDb.set(create.deviceId, d);
          return Promise.resolve(d);
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          const res = [];
          for (const d of devicesDb.values()) {
            if (d.userId === where.userId) res.push(d);
          }
          return Promise.resolve(res);
        }),
      },
      role: {
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: `role-${create.name}`, ...create })),
        findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: `role-${where.name}`, name: where.name })),
      },
      permission: {
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: `perm-${create.action}`, ...create })),
        findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: `perm-${where.action}`, action: where.action })),
      },
      rolePermission: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      userRoleAssignment: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([
          {
            role: {
              name: SystemRole.SECURITY_ADMIN,
              permissions: [
                { permission: { action: 'security.view_audit' } },
                { permission: { action: 'security.manage_sessions' } },
              ],
            },
          },
        ]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      securityEvent: {
        create: jest.fn().mockImplementation(({ data }) => {
          const ev = { id: `event-${Date.now()}`, ...data, createdAt: new Date() };
          securityEventsDb.push(ev);
          return Promise.resolve(ev);
        }),
        findFirst: jest.fn().mockImplementation(() => {
          return Promise.resolve(securityEventsDb[securityEventsDb.length - 1] || null);
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(securityEventsDb)),
      },
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

  let userAccessToken = '';
  let userRefreshToken = '';

  it('GraphQL: register mutation should create user and return tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            register(input: {
              username: "newagent"
              displayName: "New Agent"
              password: "secureAgentPassword123!"
              email: "agent@nexavoice.internal"
            }) {
              accessToken
              refreshToken
              tokenType
              expiresIn
              user {
                id
                username
                displayName
                nexaVoiceId
                accountState
              }
            }
          }
        `,
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    const data = res.body.data.register;
    expect(data.accessToken).toBeDefined();
    expect(data.refreshToken).toBeDefined();
    expect(data.user.username).toBe('newagent');
    expect(data.user.nexaVoiceId).toMatch(/^NV-\d{4}-\d{4}$/);
    expect(data.user.accountState).toBe('ACTIVE');
  });

  it('GraphQL: login mutation authenticates user and issues fresh tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            login(input: {
              identifier: "testuser"
              password: "validSecretPass123!"
            }) {
              accessToken
              refreshToken
              user {
                id
                username
                nexaVoiceId
              }
            }
          }
        `,
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    userAccessToken = res.body.data.login.accessToken;
    userRefreshToken = res.body.data.login.refreshToken;
    expect(userAccessToken).toBeDefined();
    expect(userRefreshToken).toBeDefined();
  });

  it('GraphQL: login with wrong password is rejected with 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            login(input: {
              identifier: "testuser"
              password: "wrongPassword123!"
            }) {
              accessToken
            }
          }
        `,
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toContain('Invalid credentials');
  });

  it('GraphQL: query me without authorization token is rejected with 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query {
            me {
              id
              username
            }
          }
        `,
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toContain('Authentication token missing or invalid');
  });

  it('GraphQL: query me with valid Bearer token returns current user profile', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        query: `
          query {
            me {
              id
              username
              displayName
              accountState
              roles
            }
          }
        `,
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.me.username).toBe('testuser');
    expect(res.body.data.me.accountState).toBe('ACTIVE');
    expect(res.body.data.me.roles).toContain(SystemRole.SECURITY_ADMIN);
  });

  let secondRefreshToken = '';

  it('GraphQL: refreshToken mutation rotates refresh token and returns new access token', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            refreshToken(refreshToken: "${userRefreshToken}") {
              accessToken
              refreshToken
              expiresIn
            }
          }
        `,
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    secondRefreshToken = res.body.data.refreshToken.refreshToken;
    expect(secondRefreshToken).not.toBe(userRefreshToken);
  });

  it('GraphQL: REUSE DETECTION - presenting the old rotated refresh token triggers revocation and denial', async () => {
    // Attempting to reuse userRefreshToken (which was already rotated)
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            refreshToken(refreshToken: "${userRefreshToken}") {
              accessToken
            }
          }
        `,
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toContain('reuse detected');
  });

  it('GraphQL: securityAuditLogs query verifies permissions and returns events', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        query: `
          query {
            securityAuditLogs(limit: 5) {
              id
              action
              result
            }
          }
        `,
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(Array.isArray(res.body.data.securityAuditLogs)).toBe(true);
  });

  it('GraphQL: logout mutation revokes session', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${userAccessToken}`)
      .send({
        query: `
          mutation {
            logout(allSessions: false)
          }
        `,
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.logout).toBe(true);
  });
});
