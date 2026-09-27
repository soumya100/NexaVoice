import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { SessionService } from './session.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { TokenGenerator } from '../../common/security/token-generator';

describe('SessionService - Multi-Hop Refresh Token Family & Reuse Detection', () => {
  let service: SessionService;
  let mockPrisma: any;
  let mockSecurityAudit: Partial<SecurityAuditService>;
  let mockConfig: Partial<ConfigService>;

  beforeEach(async () => {
    mockPrisma = {
      session: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'session-123',
            ...data,
          }),
        ),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'session-123' }),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        findMany: jest.fn().mockResolvedValue([{ id: 'session-123' }]),
      },
      refreshTokenFamily: {
        create: jest.fn().mockResolvedValue({ id: 'family-1', sessionId: 'session-123' }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'family-1', isRevoked: true }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      refreshToken: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'token-' + Math.random(),
            ...data,
          }),
        ),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'token-updated' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      $transaction: jest.fn().mockImplementation((arg) => {
        if (typeof arg === 'function') {
          return arg(mockPrisma);
        }
        return Promise.all(arg);
      }),
    };

    mockSecurityAudit = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockConfig = {
      get: jest.fn().mockReturnValue(604800),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SecurityAuditService, useValue: mockSecurityAudit },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  it('1. should create a session and initialize RefreshTokenFamily and root RefreshToken', async () => {
    const res = await service.createSession({
      userId: 'user-1',
      deviceId: 'device-1',
    });

    expect(res.sessionId).toBe('session-123');
    expect(res.rawRefreshToken).toBeDefined();
    expect(res.rawRefreshToken.length).toBe(64);
    expect(mockPrisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          tokenFamilies: expect.objectContaining({
            create: expect.objectContaining({
              tokens: expect.any(Object),
            }),
          }),
        }),
      }),
    );
    expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SESSION_CREATED' }),
    );
  });

  it('2. should successfully rotate T1 -> T2', async () => {
    const rawT1 = 'token-t1-secret-string';
    const hashT1 = TokenGenerator.hashToken(rawT1);

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      familyId: 'family-1',
      tokenHash: hashT1,
      usedAt: null,
      replacedByTokenId: null,
      isRevoked: false,
      expiresAt: new Date(Date.now() + 100000),
      family: {
        id: 'family-1',
        sessionId: 'session-123',
        isRevoked: false,
        session: {
          id: 'session-123',
          userId: 'user-1',
          isRevoked: false,
        },
      },
    });

    const res = await service.rotateRefreshToken(rawT1);

    expect(res.sessionId).toBe('session-123');
    expect(res.rawRefreshToken).toBeDefined();
    expect(res.rawRefreshToken).not.toBe(rawT1);
    expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rt-1' },
        data: expect.objectContaining({
          usedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('3. should DETECT REUSE when T1 is reused after rotation to T2', async () => {
    const rawT1 = 'token-t1-secret-string';
    const hashT1 = TokenGenerator.hashToken(rawT1);

    // T1 is already used!
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      familyId: 'family-1',
      tokenHash: hashT1,
      usedAt: new Date(Date.now() - 10000), // ALREADY USED
      replacedByTokenId: 'rt-2',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 100000),
      family: {
        id: 'family-1',
        sessionId: 'session-123',
        isRevoked: false,
        session: {
          id: 'session-123',
          userId: 'user-1',
          isRevoked: false,
        },
      },
    });

    await expect(service.rotateRefreshToken(rawT1)).rejects.toThrow(
      'Security incident: refresh token reuse detected. Session revoked.',
    );

    // Verify family and session were revoked
    expect(mockPrisma.refreshTokenFamily.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'family-1' },
        data: expect.objectContaining({
          isRevoked: true,
          revocationReason: 'REFRESH_TOKEN_REUSE_DETECTED',
        }),
      }),
    );
    expect(mockPrisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-123' },
        data: expect.objectContaining({
          isRevoked: true,
          revocationReason: 'REFRESH_TOKEN_REUSE_DETECTED',
        }),
      }),
    );
    expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        result: 'DENIED',
      }),
    );
  });

  it('4. MULTI-HOP TEST: should DETECT REUSE when T1 is reused after T1 -> T2 -> T3', async () => {
    const rawT1 = 'token-t1-ancient-ancestor';
    const hashT1 = TokenGenerator.hashToken(rawT1);

    // T1 was used long ago and replaced by T2, which was replaced by T3
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      familyId: 'family-1',
      tokenHash: hashT1,
      usedAt: new Date(Date.now() - 50000),
      replacedByTokenId: 'rt-2',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 100000),
      family: {
        id: 'family-1',
        sessionId: 'session-123',
        isRevoked: false,
        session: {
          id: 'session-123',
          userId: 'user-1',
          isRevoked: false,
        },
      },
    });

    await expect(service.rotateRefreshToken(rawT1)).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.refreshTokenFamily.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'family-1' },
        data: expect.objectContaining({ isRevoked: true }),
      }),
    );
  });

  it('5. MULTI-HOP TEST: should DETECT REUSE when T2 is reused after T1 -> T2 -> T3', async () => {
    const rawT2 = 'token-t2-intermediate-ancestor';
    const hashT2 = TokenGenerator.hashToken(rawT2);

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-2',
      familyId: 'family-1',
      tokenHash: hashT2,
      usedAt: new Date(Date.now() - 25000),
      replacedByTokenId: 'rt-3',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 100000),
      family: {
        id: 'family-1',
        sessionId: 'session-123',
        isRevoked: false,
        session: {
          id: 'session-123',
          userId: 'user-1',
          isRevoked: false,
        },
      },
    });

    await expect(service.rotateRefreshToken(rawT2)).rejects.toThrow(UnauthorizedException);
  });

  it('6. should reject expired refresh token', async () => {
    const rawT = 'token-expired';
    const hashT = TokenGenerator.hashToken(rawT);

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-exp',
      familyId: 'family-1',
      tokenHash: hashT,
      usedAt: null,
      replacedByTokenId: null,
      isRevoked: false,
      expiresAt: new Date(Date.now() - 1000), // Expired!
      family: {
        id: 'family-1',
        sessionId: 'session-123',
        isRevoked: false,
        session: {
          id: 'session-123',
          userId: 'user-1',
          isRevoked: false,
        },
      },
    });

    await expect(service.rotateRefreshToken(rawT)).rejects.toThrow('Refresh token has expired');
  });

  it('7. should revoke all user sessions and increment user tokenVersion', async () => {
    await service.revokeAllSessions('user-1', 'USER_PASSWORD_CHANGED');

    expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isRevoked: false },
      data: expect.objectContaining({
        isRevoked: true,
        revocationReason: 'USER_PASSWORD_CHANGED',
      }),
    });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { tokenVersion: { increment: 1 } },
    });
  });
});
