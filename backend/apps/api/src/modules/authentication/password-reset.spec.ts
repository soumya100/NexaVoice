import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthenticationService } from './authentication.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SessionService } from './session.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { RbacService } from '../authorization/rbac.service';

describe('AuthenticationService - Password Reset Flow', () => {
  let service: AuthenticationService;
  let mockPrisma: any;
  let mockSessionService: any;
  let mockSecurityAudit: any;

  const mockUser = {
    id: 'user-reset-1',
    nexaVoiceId: 'NV-RESET-1234',
    username: 'resetuser',
    email: 'reset@nexavoice.io',
    passwordHash: 'oldHash123',
    tokenVersion: 1,
    failedLoginAttempts: 2,
    lockoutUntil: new Date(),
  };

  beforeEach(async () => {
    mockPrisma = {
      isDatabaseConnected: jest.fn().mockReturnValue(true),
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    mockSessionService = {
      revokeAllSessions: jest.fn().mockResolvedValue(undefined),
    };

    mockSecurityAudit = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthenticationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SessionService, useValue: mockSessionService },
        { provide: SecurityAuditService, useValue: mockSecurityAudit },
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(900) } },
        { provide: RbacService, useValue: { assignRoleToUser: jest.fn(), getUserPermissions: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthenticationService>(AuthenticationService);
  });

  it('1. requestPasswordReset generates a reset token and logs audit event for existing user', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(mockUser);

    const res = await service.requestPasswordReset({ email: 'reset@nexavoice.io' });

    expect(res.success).toBe(true);
    expect(res.resetToken).toBeDefined();
    expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PASSWORD_RESET_REQUESTED',
        actorId: mockUser.id,
        result: 'SUCCESS',
      }),
    );
  });

  it('2. requestPasswordReset prevents email enumeration by returning success for non-existent email', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await service.requestPasswordReset({ email: 'unknown@example.com' });

    expect(res.success).toBe(true);
    expect(res.resetToken).toBeUndefined();
    expect(mockSecurityAudit.logEvent).not.toHaveBeenCalled();
  });

  it('3. resetPassword fails on invalid or expired token', async () => {
    await expect(
      service.resetPassword({
        token: 'non-existent-or-expired-token',
        newPassword: 'NewSecurePassword123!',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PASSWORD_RESET_FAILED',
        result: 'FAILURE',
      }),
    );
  });

  it('4. resetPassword enforces minimum 8 characters password length', async () => {
    await expect(
      service.resetPassword({
        token: 'any-token',
        newPassword: 'short',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('5. resetPassword successfully updates hash, increments tokenVersion, clears lockout, and revokes all active sessions', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(mockUser);
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.user.update.mockResolvedValue({ ...mockUser, tokenVersion: 2, failedLoginAttempts: 0 });

    const requestRes = await service.requestPasswordReset({ email: 'reset@nexavoice.io' });
    const token = requestRes.resetToken!;
    expect(token).toBeDefined();

    const resetRes = await service.resetPassword({
      token,
      newPassword: 'NewValidPassword123!',
    });

    expect(resetRes.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockUser.id },
        data: expect.objectContaining({
          tokenVersion: { increment: 1 },
          failedLoginAttempts: 0,
          lockoutUntil: null,
        }),
      }),
    );
    expect(mockSessionService.revokeAllSessions).toHaveBeenCalledWith(mockUser.id, 'USER_PASSWORD_RESET');
    expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PASSWORD_RESET_SUCCESS',
        actorId: mockUser.id,
        result: 'SUCCESS',
      }),
    );

    // Token cannot be reused (single-use)
    await expect(
      service.resetPassword({
        token,
        newPassword: 'AnotherPassword123!',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('6. requestPasswordReset dispatches email via EmailService when present', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(mockUser);

    const mockEmailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'test-email-id',
        provider: 'development',
        timestamp: new Date(),
      }),
    };

    const moduleWithEmail: TestingModule = await Test.createTestingModule({
      providers: [
        AuthenticationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SessionService, useValue: mockSessionService },
        { provide: SecurityAuditService, useValue: mockSecurityAudit },
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(900) } },
        { provide: RbacService, useValue: { assignRoleToUser: jest.fn(), getUserPermissions: jest.fn() } },
        { provide: 'EmailService', useValue: mockEmailService },
        { provide: require('../email/email.service').EmailService, useValue: mockEmailService },
      ],
    }).compile();

    const serviceWithEmail = moduleWithEmail.get<AuthenticationService>(AuthenticationService);

    const res = await serviceWithEmail.requestPasswordReset(
      { email: 'reset@nexavoice.io' },
      { ipAddress: '192.168.1.100' },
    );

    expect(res.success).toBe(true);
    expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: mockUser.email,
        resetToken: expect.any(String),
        ipAddress: '192.168.1.100',
      }),
    );
  });
});
