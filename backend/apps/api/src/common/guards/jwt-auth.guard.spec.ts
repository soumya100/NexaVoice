import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RbacService } from '../../modules/authorization/rbac.service';
import { AccountState } from '@nexavoice/domain-types';

describe('JwtAuthGuard - Security and Fail-Closed Validation', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let jwtService: JwtService;
  let configService: ConfigService;
  let prisma: PrismaService;
  let rbacService: RbacService;

  const mockPayload = {
    sub: 'user-123',
    nexaVoiceId: 'user_123',
    tokenVersion: 1,
    roles: ['USER'],
    sid: 'session-abc',
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;

    jwtService = {
      verifyAsync: jest.fn().mockResolvedValue(mockPayload),
    } as unknown as JwtService;

    configService = {
      get: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;

    prisma = {
      isDatabaseConnected: jest.fn().mockReturnValue(true),
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-123',
          tokenVersion: 1,
          accountState: AccountState.ACTIVE,
        }),
      },
    } as unknown as PrismaService;

    rbacService = {
      getUserPermissions: jest.fn().mockResolvedValue({
        roles: ['USER'],
        permissions: ['messaging:send'],
      }),
    } as unknown as RbacService;

    guard = new JwtAuthGuard(reflector, jwtService, configService, prisma, rbacService);
  });

  const createMockContext = (authHeader?: string): ExecutionContext => {
    const req = {
      headers: {
        authorization: authHeader,
      },
      user: null as any,
      session: null as any,
    };

    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      getArgs: () => [req, {}, { req }, {}],
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getType: () => 'http',
    } as unknown as ExecutionContext;
  };

  it('1. Valid token + healthy DB -> allowed', async () => {
    const context = createMockContext('Bearer valid-token');
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    const req = context.switchToHttp().getRequest();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('user-123');
    expect(req.user.accountState).toBe(AccountState.ACTIVE);
    expect(req.user.permissions).toContain('messaging:send');
  });

  it('2. Revoked/invalid JWT token -> denied (UnauthorizedException)', async () => {
    (jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error('jwt expired'));
    const context = createMockContext('Bearer expired-token');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('3. Changed tokenVersion -> denied', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-123',
      tokenVersion: 2, // Token has 1, DB has 2
      accountState: AccountState.ACTIVE,
    });

    const context = createMockContext('Bearer valid-token');
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Session token was invalidated; please log in again.',
    );
  });

  it('4. Suspended account -> denied', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-123',
      tokenVersion: 1,
      accountState: AccountState.SUSPENDED,
    });

    const context = createMockContext('Bearer valid-token');
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Account is SUSPENDED; access denied.',
    );
  });

  it('5. Database unavailable -> FAILS CLOSED (never assigns default USER access)', async () => {
    (prisma.isDatabaseConnected as jest.Mock).mockReturnValue(false);

    const context = createMockContext('Bearer valid-token');
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Authentication service degraded: session authority unreachable',
    );

    const req = context.switchToHttp().getRequest();
    expect(req.user).toBeNull();
  });

  it('6. Missing or malformed authorization header -> denied', async () => {
    const context1 = createMockContext(undefined);
    await expect(guard.canActivate(context1)).rejects.toThrow('Authentication token missing or invalid');

    const context2 = createMockContext('Basic invalid');
    await expect(guard.canActivate(context2)).rejects.toThrow('Authentication token missing or invalid');
  });
});
