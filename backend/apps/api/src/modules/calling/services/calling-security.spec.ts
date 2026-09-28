import { Test, TestingModule } from '@nestjs/testing';
import { CallingAuthorizationService } from './calling-authorization.service';
import { IceServerService } from './ice-server.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuthorizationDecisionService } from '../../authorization/authorization-decision.service';
import { RbacService } from '../../authorization/rbac.service';
import { ConfigService } from '@nestjs/config';
import { AccountState, ParticipantRole } from '@nexavoice/domain-types';
import {
  CallAuthorizationException,
  CallNotFoundException,
  CallParticipantLimitExceededException,
} from '../exceptions/calling.exceptions';

describe('Calling Security & Zero-Trust Authorization', () => {
  let authService: CallingAuthorizationService;
  let iceServerService: IceServerService;
  let mockPrisma: any;
  let mockDecisionService: any;
  let mockRbacService: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockPrisma = {
      callSession: {
        findUnique: jest.fn(),
      },
      callParticipant: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    mockDecisionService = {
      authorize: jest.fn().mockResolvedValue({ allowed: true }),
    };

    mockRbacService = {
      getUserPermissions: jest.fn().mockResolvedValue({ roles: ['USER'], permissions: [] }),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, def?: any) => {
        if (key === 'TURN_SECRET') return 'top-secret-turn-key-32-chars-minimum!';
        if (key === 'TURN_URLS') return 'turn:turn.nexavoice.internal:3478?transport=udp';
        return def;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallingAuthorizationService,
        IceServerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthorizationDecisionService, useValue: mockDecisionService },
        { provide: RbacService, useValue: mockRbacService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authService = module.get<CallingAuthorizationService>(CallingAuthorizationService);
    iceServerService = module.get<IceServerService>(IceServerService);
  });

  describe('IDOR Prevention (assertCanAccessCall)', () => {
    it('allows access to host user', async () => {
      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        hostUserId: 'user-host',
        participants: [],
      });

      const call = await authService.assertCanAccessCall('user-host', 'call-1');
      expect(call).toBeDefined();
    });

    it('allows access to active participant', async () => {
      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        hostUserId: 'user-host',
        participants: [{ userId: 'user-participant' }],
      });

      const call = await authService.assertCanAccessCall('user-participant', 'call-1');
      expect(call).toBeDefined();
    });

    it('denies access to unrelated User B (prevents IDOR)', async () => {
      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        hostUserId: 'user-host',
        participants: [{ userId: 'user-participant' }],
      });

      await expect(
        authService.assertCanAccessCall('attacker-user-b', 'call-1'),
      ).rejects.toThrow(CallAuthorizationException);
    });

    it('throws CallNotFoundException if call does not exist', async () => {
      mockPrisma.callSession.findUnique.mockResolvedValueOnce(null);

      await expect(
        authService.assertCanAccessCall('user-1', 'call-missing'),
      ).rejects.toThrow(CallNotFoundException);
    });
  });

  describe('Call Join Authorization (assertCanJoinCall)', () => {
    it('rejects suspended or locked accounts from joining calls', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-suspended',
        accountState: AccountState.SUSPENDED,
      });

      await expect(
        authService.assertCanJoinCall('user-suspended', 'call-1'),
      ).rejects.toThrow('Account is not eligible to join calls');
    });

    it('enforces maximum participant capacity limit (e.g. 100 participants)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-101',
        accountState: AccountState.ACTIVE,
      });

      const fullParticipants = Array.from({ length: 100 }, (_, i) => ({
        id: `p-${i}`,
        userId: `u-${i}`,
        state: 'CONNECTED',
      }));

      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-full',
        maxParticipants: 100,
        participants: fullParticipants,
      });

      await expect(
        authService.assertCanJoinCall('user-101', 'call-full'),
      ).rejects.toThrow(CallParticipantLimitExceededException);
    });
  });

  describe('Participant Moderation Authorization', () => {
    it('allows self-mute for any participant', async () => {
      const allowed = await authService.assertCanMuteParticipant('user-1', 'call-1', 'user-1');
      expect(allowed).toBe(true);
    });

    it('allows HOST or CO_HOST to mute other participants', async () => {
      mockPrisma.callParticipant.findUnique.mockResolvedValueOnce({
        id: 'p-host',
        userId: 'user-host',
        role: ParticipantRole.HOST,
        canMuteOthers: true,
      });

      const allowed = await authService.assertCanMuteParticipant('user-host', 'call-1', 'user-target');
      expect(allowed).toBe(true);
    });

    it('rejects regular participant attempting to mute others', async () => {
      mockPrisma.callParticipant.findUnique.mockResolvedValueOnce({
        id: 'p-reg',
        userId: 'user-reg',
        role: ParticipantRole.PARTICIPANT,
        canMuteOthers: false,
      });

      await expect(
        authService.assertCanMuteParticipant('user-reg', 'call-1', 'user-target'),
      ).rejects.toThrow('Forbidden: You do not have permission to mute other participants');
    });

    it('rejects non-moderator attempting to remove a participant', async () => {
      mockPrisma.callParticipant.findUnique.mockResolvedValueOnce({
        id: 'p-reg',
        userId: 'user-reg',
        role: ParticipantRole.PARTICIPANT,
        canRemoveParticipants: false,
      });

      await expect(
        authService.assertCanRemoveParticipant('user-reg', 'call-1', 'user-target'),
      ).rejects.toThrow('Forbidden: You do not have permission to remove participants from this call');
    });
  });

  describe('Ephemeral TURN Credentials (IceServerService)', () => {
    it('generates short-lived HMAC-SHA1 credentials conforming to RFC 5766', () => {
      const configs = iceServerService.getIceServers('user-secure', 3600);
      const turnConfig = configs.find((c) => Array.isArray(c.urls) ? c.urls[0].includes('turn:') : String(c.urls).includes('turn:'));

      expect(turnConfig).toBeDefined();
      expect(turnConfig?.username).toContain(':user-secure');
      expect(turnConfig?.credential).toBeDefined();
      expect(typeof turnConfig?.credential).toBe('string');
      expect(turnConfig?.credential?.length).toBeGreaterThan(10);
    });
  });
});
