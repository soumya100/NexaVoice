import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { SessionService } from './session.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { TokenGenerator } from '../../common/security/token-generator';

describe('SessionService', () => {
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
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
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

  it('should create a new session and return high-entropy refresh token', async () => {
    const res = await service.createSession({
      userId: 'user-1',
      deviceId: 'device-1',
    });

    expect(res.sessionId).toBe('session-123');
    expect(res.rawRefreshToken).toBeDefined();
    expect(res.rawRefreshToken.length).toBe(64); // 32 bytes hex
    expect(mockPrisma.session.create).toHaveBeenCalled();
    expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SESSION_CREATED' }),
    );
  });

  it('should successfully rotate an active refresh token', async () => {
    const rawOldToken = 'valid-active-refresh-token';
    const oldHash = TokenGenerator.hashToken(rawOldToken);

    mockPrisma.session.findFirst.mockResolvedValue(null); // No reuse detected
    mockPrisma.session.findUnique.mockResolvedValue({
      id: 'session-123',
      userId: 'user-1',
      tokenHash: oldHash,
      isRevoked: false,
      expiresAt: new Date(Date.now() + 100000),
    });

    const res = await service.rotateRefreshToken(rawOldToken);

    expect(res.sessionId).toBe('session-123');
    expect(res.rawRefreshToken).toBeDefined();
    expect(res.rawRefreshToken).not.toBe(rawOldToken);
    expect(mockPrisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-123' },
        data: expect.objectContaining({
          replacedByTokenHash: oldHash,
        }),
      }),
    );
  });

  it('should DETECT REUSE and immediately REVOKE session when a replaced token is re-sent', async () => {
    const stolenOldToken = 'stolen-previously-rotated-token';
    const stolenHash = TokenGenerator.hashToken(stolenOldToken);

    // findFirst matches on replacedByTokenHash -> Reuse attack!
    mockPrisma.session.findFirst.mockResolvedValue({
      id: 'compromised-session-999',
      userId: 'victim-user-1',
      replacedByTokenHash: stolenHash,
    });

    await expect(service.rotateRefreshToken(stolenOldToken)).rejects.toThrow(
      UnauthorizedException,
    );

    // Verifies session revocation in DB
    expect(mockPrisma.session.update).toHaveBeenCalledWith({
      where: { id: 'compromised-session-999' },
      data: expect.objectContaining({
        isRevoked: true,
        revocationReason: 'REFRESH_TOKEN_REUSE_DETECTED',
      }),
    });

    // Verifies security audit incident event was recorded
    expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        result: 'DENIED',
      }),
    );
  });

  it('should revoke all user sessions and increment user tokenVersion', async () => {
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
