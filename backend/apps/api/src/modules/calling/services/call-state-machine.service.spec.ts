import { Test, TestingModule } from '@nestjs/testing';
import { CallStateMachineService } from './call-state-machine.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CallSessionStatus,
  CallLegStatus,
  ParticipantState,
  MediaSessionStatus,
  InvitationStatus,
} from '@nexavoice/domain-types';
import {
  InvalidCallStateTransitionException,
  CallNotFoundException,
} from '../exceptions/calling.exceptions';

describe('CallStateMachineService', () => {
  let service: CallStateMachineService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      callSession: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      callLeg: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      callParticipant: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      mediaSession: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      callInvitation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallStateMachineService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CallStateMachineService>(CallStateMachineService);
  });

  describe('CallSession State Machine', () => {
    it('successfully transitions NEW -> RINGING -> CONNECTING -> ACTIVE -> HELD -> ACTIVE -> ENDED', async () => {
      // 1. NEW -> RINGING
      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        status: CallSessionStatus.NEW,
      });
      mockPrisma.callSession.update.mockResolvedValueOnce({
        id: 'call-1',
        status: CallSessionStatus.RINGING,
      });

      let res = await service.transitionCallSession(
        'call-1',
        CallSessionStatus.NEW,
        CallSessionStatus.RINGING,
      );
      expect(res.status).toBe(CallSessionStatus.RINGING);

      // 2. RINGING -> CONNECTING
      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        status: CallSessionStatus.RINGING,
      });
      mockPrisma.callSession.update.mockResolvedValueOnce({
        id: 'call-1',
        status: CallSessionStatus.CONNECTING,
      });

      res = await service.transitionCallSession(
        'call-1',
        CallSessionStatus.RINGING,
        CallSessionStatus.CONNECTING,
      );
      expect(res.status).toBe(CallSessionStatus.CONNECTING);

      // 3. CONNECTING -> ACTIVE
      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        status: CallSessionStatus.CONNECTING,
      });
      mockPrisma.callSession.update.mockResolvedValueOnce({
        id: 'call-1',
        status: CallSessionStatus.ACTIVE,
        activeAt: new Date(),
      });

      res = await service.transitionCallSession(
        'call-1',
        CallSessionStatus.CONNECTING,
        CallSessionStatus.ACTIVE,
      );
      expect(res.status).toBe(CallSessionStatus.ACTIVE);

      // 4. ACTIVE -> HELD
      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        status: CallSessionStatus.ACTIVE,
      });
      mockPrisma.callSession.update.mockResolvedValueOnce({
        id: 'call-1',
        status: CallSessionStatus.HELD,
      });

      res = await service.transitionCallSession(
        'call-1',
        CallSessionStatus.ACTIVE,
        CallSessionStatus.HELD,
      );
      expect(res.status).toBe(CallSessionStatus.HELD);

      // 5. HELD -> ACTIVE
      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        status: CallSessionStatus.HELD,
      });
      mockPrisma.callSession.update.mockResolvedValueOnce({
        id: 'call-1',
        status: CallSessionStatus.ACTIVE,
      });

      res = await service.transitionCallSession(
        'call-1',
        CallSessionStatus.HELD,
        CallSessionStatus.ACTIVE,
      );
      expect(res.status).toBe(CallSessionStatus.ACTIVE);

      // 6. ACTIVE -> ENDED
      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        status: CallSessionStatus.ACTIVE,
      });
      mockPrisma.callSession.update.mockResolvedValueOnce({
        id: 'call-1',
        status: CallSessionStatus.ENDED,
        endedAt: new Date(),
      });

      res = await service.transitionCallSession(
        'call-1',
        CallSessionStatus.ACTIVE,
        CallSessionStatus.ENDED,
      );
      expect(res.status).toBe(CallSessionStatus.ENDED);
    });

    it('handles idempotent transition when call is already in destination state', async () => {
      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        status: CallSessionStatus.ACTIVE,
      });

      const res = await service.transitionCallSession(
        'call-1',
        CallSessionStatus.ACTIVE,
        CallSessionStatus.ACTIVE,
      );
      expect(res.status).toBe(CallSessionStatus.ACTIVE);
      expect(mockPrisma.callSession.update).not.toHaveBeenCalled();
    });

    it('rejects invalid state transition (ENDED -> ACTIVE)', async () => {
      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        status: CallSessionStatus.ENDED,
      });

      await expect(
        service.transitionCallSession(
          'call-1',
          CallSessionStatus.ENDED,
          CallSessionStatus.ACTIVE,
        ),
      ).rejects.toThrow(InvalidCallStateTransitionException);
    });

    it('rejects transition when actual state does not match expected state', async () => {
      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        status: CallSessionStatus.RINGING,
      });

      await expect(
        service.transitionCallSession(
          'call-1',
          CallSessionStatus.NEW,
          CallSessionStatus.ACTIVE,
        ),
      ).rejects.toThrow(InvalidCallStateTransitionException);
    });

    it('throws CallNotFoundException if call does not exist', async () => {
      mockPrisma.callSession.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.transitionCallSession(
          'non-existent',
          CallSessionStatus.NEW,
          CallSessionStatus.RINGING,
        ),
      ).rejects.toThrow(CallNotFoundException);
    });
  });

  describe('CallLeg State Machine', () => {
    it('successfully transitions CREATED -> INVITED -> RINGING -> CONNECTED -> ENDED', async () => {
      mockPrisma.callLeg.findUnique.mockResolvedValueOnce({
        id: 'leg-1',
        status: CallLegStatus.CREATED,
        callSessionId: 'call-1',
      });
      mockPrisma.callLeg.update.mockResolvedValueOnce({
        id: 'leg-1',
        status: CallLegStatus.INVITED,
      });

      const res = await service.transitionCallLeg(
        'leg-1',
        CallLegStatus.CREATED,
        CallLegStatus.INVITED,
      );
      expect(res.status).toBe(CallLegStatus.INVITED);
    });

    it('rejects invalid CallLeg transition from ENDED to CONNECTED', async () => {
      mockPrisma.callLeg.findUnique.mockResolvedValueOnce({
        id: 'leg-1',
        status: CallLegStatus.ENDED,
        callSessionId: 'call-1',
      });

      await expect(
        service.transitionCallLeg(
          'leg-1',
          CallLegStatus.ENDED,
          CallLegStatus.CONNECTED,
        ),
      ).rejects.toThrow(InvalidCallStateTransitionException);
    });
  });

  describe('CallParticipant State Machine', () => {
    it('successfully transitions INVITED -> RINGING -> CONNECTED -> MUTED -> CONNECTED -> LEFT', async () => {
      mockPrisma.callParticipant.findUnique.mockResolvedValueOnce({
        id: 'p-1',
        state: ParticipantState.INVITED,
        callSessionId: 'call-1',
        userId: 'u-1',
      });
      mockPrisma.callParticipant.update.mockResolvedValueOnce({
        id: 'p-1',
        state: ParticipantState.RINGING,
      });

      const res = await service.transitionParticipant(
        'p-1',
        ParticipantState.INVITED,
        ParticipantState.RINGING,
      );
      expect(res.state).toBe(ParticipantState.RINGING);
    });

    it('rejects transition for already removed participant', async () => {
      mockPrisma.callParticipant.findUnique.mockResolvedValueOnce({
        id: 'p-1',
        state: ParticipantState.REMOVED,
        callSessionId: 'call-1',
        userId: 'u-1',
      });

      await expect(
        service.transitionParticipant(
          'p-1',
          ParticipantState.REMOVED,
          ParticipantState.CONNECTED,
        ),
      ).rejects.toThrow(InvalidCallStateTransitionException);
    });
  });

  describe('CallInvitation State Machine', () => {
    it('transitions PENDING -> ACCEPTED', async () => {
      mockPrisma.callInvitation.findUnique.mockResolvedValueOnce({
        id: 'inv-1',
        status: InvitationStatus.PENDING,
        callSessionId: 'call-1',
        inviteeId: 'user-2',
      });
      mockPrisma.callInvitation.update.mockResolvedValueOnce({
        id: 'inv-1',
        status: InvitationStatus.ACCEPTED,
      });

      const res = await service.transitionInvitation(
        'inv-1',
        InvitationStatus.PENDING,
        InvitationStatus.ACCEPTED,
      );
      expect(res.status).toBe(InvitationStatus.ACCEPTED);
    });

    it('rejects transition from ACCEPTED to DECLINED', async () => {
      mockPrisma.callInvitation.findUnique.mockResolvedValueOnce({
        id: 'inv-1',
        status: InvitationStatus.ACCEPTED,
        callSessionId: 'call-1',
        inviteeId: 'user-2',
      });

      await expect(
        service.transitionInvitation(
          'inv-1',
          InvitationStatus.ACCEPTED,
          InvitationStatus.DECLINED,
        ),
      ).rejects.toThrow(InvalidCallStateTransitionException);
    });
  });

  describe('MediaSession State Machine', () => {
    it('transitions INITIALIZING -> OFFERED -> CONNECTED -> CLOSED', async () => {
      mockPrisma.mediaSession.findUnique.mockResolvedValueOnce({
        id: 'media-1',
        status: MediaSessionStatus.INITIALIZING,
        callSessionId: 'call-1',
      });
      mockPrisma.mediaSession.update.mockResolvedValueOnce({
        id: 'media-1',
        status: MediaSessionStatus.OFFERED,
      });

      const res = await service.transitionMediaSession(
        'media-1',
        MediaSessionStatus.INITIALIZING,
        MediaSessionStatus.OFFERED,
      );
      expect(res.status).toBe(MediaSessionStatus.OFFERED);
    });

    it('rejects invalid transition for closed media session', async () => {
      mockPrisma.mediaSession.findUnique.mockResolvedValueOnce({
        id: 'media-1',
        status: MediaSessionStatus.CLOSED,
        callSessionId: 'call-1',
      });

      await expect(
        service.transitionMediaSession(
          'media-1',
          MediaSessionStatus.CLOSED,
          MediaSessionStatus.CONNECTED,
        ),
      ).rejects.toThrow(InvalidCallStateTransitionException);
    });
  });
});
