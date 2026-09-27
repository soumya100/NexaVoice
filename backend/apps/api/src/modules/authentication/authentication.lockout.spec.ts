import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthenticationService } from './authentication.service';
import { SessionService } from './session.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { PasswordHasher } from '../../common/security/password-hasher';
import { AccountState } from '@nexavoice/domain-types';

describe('AuthenticationService - Lockout & Account State Enforcement', () => {
  let service: AuthenticationService;
  let mockPrisma: any;
  let mockSessionService: any;
  let mockSecurityAudit: any;
  let mockJwtService: any;
  let mockConfigService: any;

  let hashedPassword: string;

  beforeAll(async () => {
    hashedPassword = await PasswordHasher.hash('ValidPassword123!');
  });

  beforeEach(async () => {
    mockPrisma = {
      isDatabaseConnected: jest.fn().mockReturnValue(true),
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'user-1',
          username: 'testuser',
          displayName: 'Test User',
          email: 'test@example.com',
          roles: [],
          status: 'ONLINE',
          createdAt: new Date(),
        }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'user-1', ...data })),
      },
    };

    mockSessionService = {
      createSession: jest.fn().mockResolvedValue({
        sessionId: 'sess-1',
        rawRefreshToken: 'rt-1',
      }),
    };

    mockSecurityAudit = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('jwt-token'),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue(3600),
    };

    const mockRbacService = {
      assignRoleToUser: jest.fn().mockResolvedValue(undefined),
      getUserPermissions: jest.fn().mockResolvedValue({ roles: ['USER'], permissions: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthenticationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SessionService, useValue: mockSessionService },
        { provide: SecurityAuditService, useValue: mockSecurityAudit },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: 'RbacService', useValue: mockRbacService },
        { provide: require('../authorization/rbac.service').RbacService, useValue: mockRbacService },
      ],
    }).compile();

    service = module.get<AuthenticationService>(AuthenticationService);
  });

  describe('5-Attempt Account Lockout Flow', () => {
    it('1. should increment failed attempts on bad password and trigger lockout on attempt 5', async () => {
      // Mock user at 4 failed attempts
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordHash: hashedPassword,
        accountState: AccountState.ACTIVE,
        failedLoginAttempts: 4,
        lockoutUntil: null,
      });

      await expect(
        service.login({
          identifier: 'test@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow('Invalid credentials');

      // 5th failed attempt should set lockoutUntil
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          failedLoginAttempts: 5,
          lockoutUntil: expect.any(Date),
        }),
      });

      expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILURE_LOCKOUT_TRIGGERED',
          result: 'FAILURE',
        }),
      );
    });

    it('2. should reject subsequent attempts during lockout period without checking password', async () => {
      // User is locked out until 10 minutes in the future
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordHash: hashedPassword,
        accountState: AccountState.ACTIVE,
        failedLoginAttempts: 5,
        lockoutUntil: new Date(Date.now() + 10 * 60 * 1000),
      });

      await expect(
        service.login({
          identifier: 'test@example.com',
          password: 'ValidPassword123!',
        }),
      ).rejects.toThrow('Account is temporarily locked due to failed login attempts.');

      expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_REJECTED_LOCKED_OUT',
          result: 'DENIED',
        }),
      );
    });

    it('3. should reset failedLoginAttempts and lockoutUntil on successful login', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordHash: hashedPassword,
        accountState: AccountState.ACTIVE,
        failedLoginAttempts: 2,
        lockoutUntil: null,
        roles: [],
        tokenVersion: 1,
        nexaVoiceId: 'user_1',
      });

      const res = await service.login({
        identifier: 'test@example.com',
        password: 'ValidPassword123!',
      });

      expect(res.accessToken).toBe('jwt-token');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          failedLoginAttempts: 0,
          lockoutUntil: null,
        }),
      });
    });
  });

  describe('Account State Validation Matrix', () => {
    const states = [
      AccountState.SUSPENDED,
      AccountState.LOCKED,
      AccountState.DEACTIVATED,
      AccountState.DELETED,
    ];

    states.forEach((state) => {
      it(`should strictly REJECT login when accountState is ${state}`, async () => {
        mockPrisma.user.findFirst.mockResolvedValue({
          id: 'user-1',
          passwordHash: hashedPassword,
          accountState: state,
          failedLoginAttempts: 0,
          lockoutUntil: null,
        });

        await expect(
          service.login({
            identifier: 'test@example.com',
            password: 'ValidPassword123!',
          }),
        ).rejects.toThrow(`Account is ${state}; access denied.`);

        expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'LOGIN_REJECTED_ACCOUNT_STATE',
            result: 'DENIED',
          }),
        );
      });
    });
  });
});
