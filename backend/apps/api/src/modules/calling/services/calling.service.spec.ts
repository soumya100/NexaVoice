import { Test, TestingModule } from '@nestjs/testing';
import { CallingService } from './calling.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CallStateMachineService } from './call-state-machine.service';
import { CallingAuthorizationService } from './calling-authorization.service';
import { LocalPeerMediaProvider } from '../media-provider/local-peer.media-provider';
import { SfuMediaProvider } from '../media-provider/sfu.media-provider';
import { SignalingGateway } from '../../realtime/signaling.gateway';
import { DefaultTranscriptionProvider } from '../transcription/default-transcription.provider';
import { CallType, CallSessionStatus, ParticipantRole, ParticipantState } from '@nexavoice/domain-types';

describe('CallingService', () => {
  let service: CallingService;
  let mockPrisma: any;
  let mockStateMachine: any;
  let mockAuthService: any;
  let mockSignalingGateway: any;
  let mockLocalPeerProvider: any;
  let mockSfuProvider: any;

  beforeEach(async () => {
    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (callback) => callback(mockPrisma)),
      callSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      callParticipant: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: `p-${data.userId}`,
          ...data,
        })),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      callLeg: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: `leg-${data.userId}`,
          ...data,
        })),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      mediaSession: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      callInvitation: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: `inv-${data.inviteeId}`,
          ...data,
        })),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      callEvent: {
        create: jest.fn(),
      },
      outboxEvent: {
        create: jest.fn(),
      },
      message: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: `msg-${Date.now()}`,
          ...data,
          createdAt: new Date(),
        })),
      },
    };

    mockStateMachine = {
      transitionCallSession: jest.fn(),
      transitionCallLeg: jest.fn(),
      transitionParticipant: jest.fn(),
      transitionInvitation: jest.fn(),
      transitionMediaSession: jest.fn(),
    };

    mockAuthService = {
      assertCanAccessCall: jest.fn().mockResolvedValue(true),
      assertCanJoinCall: jest.fn().mockResolvedValue(true),
      assertCanEndCall: jest.fn().mockResolvedValue({ id: 'call-1', hostUserId: 'host-1' }),
      assertCanMuteParticipant: jest.fn().mockResolvedValue(true),
      assertCanRemoveParticipant: jest.fn().mockResolvedValue(true),
    };

    mockSignalingGateway = {
      broadcastToUser: jest.fn(),
      broadcastToCall: jest.fn(),
      evictUserFromCall: jest.fn(),
      evictAllFromCall: jest.fn(),
    };

    mockLocalPeerProvider = {
      createSession: jest.fn().mockResolvedValue({
        provider: 'local-peer-webrtc',
        mode: 'P2P_DIRECT',
        providerSessionId: 'p2p-1',
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      }),
      getIceServers: jest.fn().mockResolvedValue([{ urls: 'stun:stun.l.google.com:19302' }]),
    };

    mockSfuProvider = {
      createSession: jest.fn().mockResolvedValue({
        provider: 'sfu-livekit',
        mode: 'SFU_ROUTED',
        providerSessionId: 'sfu-1',
        sfuRoomId: 'room-1',
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      }),
    };

    const mockTranscriptionProvider = {
      providerName: 'default-internal',
      processAudio: jest.fn().mockResolvedValue({
        fullText: 'Hello world',
        segments: [{ speakerLabel: 'Host', startMs: 0, endMs: 1000, text: 'Hello world', confidence: 0.99 }],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CallStateMachineService, useValue: mockStateMachine },
        { provide: CallingAuthorizationService, useValue: mockAuthService },
        { provide: LocalPeerMediaProvider, useValue: mockLocalPeerProvider },
        { provide: SfuMediaProvider, useValue: mockSfuProvider },
        { provide: SignalingGateway, useValue: mockSignalingGateway },
        { provide: DefaultTranscriptionProvider, useValue: mockTranscriptionProvider },
      ],
    }).compile();

    service = module.get<CallingService>(CallingService);
  });

  describe('initiateCall', () => {
    it('creates 1:1 call with local peer provider and publishes outbox event', async () => {
      mockPrisma.callSession.create.mockResolvedValueOnce({
        id: 'call-1',
        callType: CallType.VOICE,
        status: CallSessionStatus.NEW,
        hostUserId: 'host-1',
        startedAt: new Date(),
      });

      mockPrisma.callParticipant.create.mockResolvedValueOnce({
        id: 'p-host',
        callSessionId: 'call-1',
        userId: 'host-1',
        role: ParticipantRole.HOST,
        state: ParticipantState.CONNECTED,
      });

      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        callType: CallType.VOICE,
        status: CallSessionStatus.NEW,
        hostUserId: 'host-1',
        startedAt: new Date(),
        participants: [
          {
            id: 'p-host',
            userId: 'host-1',
            role: 'HOST',
            state: 'CONNECTED',
            canMuteOthers: true,
            canRemoveParticipants: true,
            canInviteParticipants: true,
            canShareScreen: true,
            canRecord: true,
            canEndCall: true,
            joinedAt: new Date(),
            user: { displayName: 'Host' },
          },
        ],
        legs: [],
        mediaSessions: [],
      });

      const result = await service.initiateCall('host-1', {
        callType: CallType.VOICE,
        inviteeUserIds: ['user-2'],
      });

      expect(mockPrisma.callSession.create).toHaveBeenCalled();
      expect(mockLocalPeerProvider.createSession).toHaveBeenCalled();
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'call.created',
            aggregateId: 'call-1',
          }),
        }),
      );
      expect(mockSignalingGateway.broadcastToUser).toHaveBeenCalledWith(
        'user-2',
        'call.incoming',
        expect.any(Object),
      );
      expect(result.id).toBe('call-1');
    });

    it('uses SfuMediaProvider for group calls with up to 100 participants', async () => {
      mockPrisma.callSession.create.mockResolvedValueOnce({
        id: 'group-call-1',
        callType: CallType.GROUP_VIDEO,
        status: CallSessionStatus.NEW,
        hostUserId: 'host-1',
        startedAt: new Date(),
      });

      mockPrisma.callParticipant.create.mockResolvedValueOnce({
        id: 'p-host',
        callSessionId: 'group-call-1',
        userId: 'host-1',
        role: ParticipantRole.HOST,
        state: ParticipantState.CONNECTED,
      });

      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'group-call-1',
        callType: CallType.GROUP_VIDEO,
        status: CallSessionStatus.NEW,
        hostUserId: 'host-1',
        startedAt: new Date(),
        participants: [],
        legs: [],
        mediaSessions: [],
      });

      await service.initiateCall('host-1', {
        callType: CallType.GROUP_VIDEO,
        inviteeUserIds: ['user-2', 'user-3'],
        maxParticipants: 100,
      });

      expect(mockSfuProvider.createSession).toHaveBeenCalled();
    });
  });

  describe('acceptCall', () => {
    it('transitions call to active, transitions participant to connected, and cancels ringing on other devices', async () => {
      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        status: 'RINGING',
        participants: [{ id: 'p-2', userId: 'user-2', state: 'INVITED' }],
        invitations: [{ id: 'inv-1', inviteeId: 'user-2', status: 'PENDING' }],
      });

      mockPrisma.callLeg.findFirst.mockResolvedValueOnce({
        id: 'leg-2',
        callSessionId: 'call-1',
        userId: 'user-2',
      });

      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        status: 'ACTIVE',
        hostUserId: 'host-1',
        callType: 'VOICE',
        startedAt: new Date(),
        participants: [],
        legs: [],
        mediaSessions: [],
      });

      await service.acceptCall('user-2', 'call-1');

      expect(mockStateMachine.transitionInvitation).toHaveBeenCalled();
      expect(mockStateMachine.transitionParticipant).toHaveBeenCalled();
      expect(mockStateMachine.transitionCallSession).toHaveBeenCalled();
      expect(mockSignalingGateway.broadcastToUser).toHaveBeenCalledWith(
        'user-2',
        'call.ringing.cancelled',
        expect.any(Object),
      );
      expect(mockSignalingGateway.broadcastToCall).toHaveBeenCalledWith(
        'call-1',
        'call.accepted',
        expect.any(Object),
      );
    });
  });

  describe('endCall', () => {
    it('transitions call to ended, closes media session, and evicts all sockets from call room', async () => {
      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        hostUserId: 'host-1',
        status: 'ACTIVE',
      });

      await service.endCall('host-1', 'call-1', 'HOST_TERMINATED');

      expect(mockAuthService.assertCanEndCall).toHaveBeenCalledWith('host-1', 'call-1');
      expect(mockStateMachine.transitionCallSession).toHaveBeenCalled();
      expect(mockPrisma.callParticipant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ callSessionId: 'call-1' }),
          data: expect.objectContaining({ state: 'LEFT' }),
        }),
      );
      expect(mockSignalingGateway.evictAllFromCall).toHaveBeenCalledWith('call-1', 'HOST_TERMINATED');
    });
  });

  describe('removeParticipant', () => {
    it('moderator removes participant, transitions state to REMOVED, and evicts socket room', async () => {
      mockPrisma.callParticipant.findUnique.mockResolvedValueOnce({
        id: 'p-target',
        callSessionId: 'call-1',
        userId: 'target-user',
      });

      await service.removeParticipant('host-1', 'call-1', 'target-user', 'RULE_VIOLATION');

      expect(mockAuthService.assertCanRemoveParticipant).toHaveBeenCalledWith('host-1', 'call-1', 'target-user');
      expect(mockStateMachine.transitionParticipant).toHaveBeenCalledWith(
        'p-target',
        expect.any(Array),
        'REMOVED',
        expect.anything(),
      );
      expect(mockSignalingGateway.evictUserFromCall).toHaveBeenCalledWith(
        'target-user',
        'call-1',
        'RULE_VIOLATION',
      );
      expect(mockSignalingGateway.broadcastToCall).toHaveBeenCalledWith(
        'call-1',
        'call.participant.removed',
        expect.any(Object),
      );
    });
  });

  describe('conversation-linked calling', () => {
    it('creates CALL_EVENT message in conversation when call is initiated with conversationId', async () => {
      mockPrisma.callSession.create.mockResolvedValueOnce({
        id: 'call-conv-1',
        callType: 'VOICE',
        status: 'NEW',
        hostUserId: 'host-1',
        conversationId: 'conv-123',
        startedAt: new Date(),
      });

      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-conv-1',
        callType: 'VOICE',
        status: 'NEW',
        hostUserId: 'host-1',
        conversationId: 'conv-123',
        startedAt: new Date(),
        participants: [
          {
            id: 'p-host',
            userId: 'host-1',
            role: 'HOST',
            state: 'CONNECTED',
            canMuteOthers: true,
            canRemoveParticipants: true,
            canInviteParticipants: true,
            canShareScreen: true,
            canRecord: true,
            canEndCall: true,
            joinedAt: new Date(),
            createdAt: new Date(),
            legs: [],
          },
        ],
        legs: [],
        mediaSessions: [],
        invitations: [],
      });

      await service.initiateCall('host-1', {
        callType: 'VOICE' as any,
        inviteeUserIds: ['user-2'],
        conversationId: 'conv-123',
      });

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: 'conv-123',
          senderId: 'host-1',
          type: 'CALL_EVENT',
          content: expect.stringContaining('CALL_STARTED'),
        }),
      });
    });

    it('creates CALL_EVENT message in conversation when call with conversationId is ended', async () => {
      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        conversationId: 'conv-123',
        startedAt: new Date(Date.now() - 30000),
        status: 'ACTIVE',
      });

      await service.endCall('host-1', 'call-1', 'NORMAL_CLEARING');

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: 'conv-123',
          senderId: 'host-1',
          type: 'CALL_EVENT',
          content: expect.stringContaining('CALL_ENDED'),
        }),
      });
    });
  });
});

