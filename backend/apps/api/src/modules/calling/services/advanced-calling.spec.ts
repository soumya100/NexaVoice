import { Test, TestingModule } from '@nestjs/testing';
import { CallingService } from './calling.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CallStateMachineService } from './call-state-machine.service';
import { CallingAuthorizationService } from './calling-authorization.service';
import { LocalPeerMediaProvider } from '../media-provider/local-peer.media-provider';
import { SfuMediaProvider } from '../media-provider/sfu.media-provider';
import { SignalingGateway } from '../../realtime/signaling.gateway';
import { DefaultTranscriptionProvider } from '../transcription/default-transcription.provider';
import {
  CallType,
  CallSessionStatus,
  WaitingRoomState,
  DeviceTransferStatus,
  RecordingStatus,
  RecordingType,
  ConsentState,
  ScheduledCallStatus,
} from '@nexavoice/domain-types';

describe('AdvancedCalling (Milestone 5)', () => {
  let service: CallingService;
  let mockPrisma: any;
  let mockStateMachine: any;
  let mockAuthService: any;
  let mockSignalingGateway: any;
  let mockLocalPeerProvider: any;
  let mockSfuProvider: any;
  let mockTranscriptionProvider: any;

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
      callTransfer: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'transfer-1',
          ...data,
        })),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      conferenceSession: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'conf-1',
          ...data,
        })),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        upsert: jest.fn().mockImplementation(async ({ create }: any) => ({
          id: 'conf-1',
          ...create,
        })),
      },
      conferenceParticipant: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: `conf-p-${data.userId}`,
          ...data,
        })),
        update: jest.fn(),
      },
      conferenceEvent: {
        create: jest.fn(),
      },
      callDeviceTransfer: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'dev-tx-1',
          ...data,
          initiatedAt: new Date(),
        })),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      recordingSession: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'rec-1',
          ...data,
          startedAt: new Date(),
          durationSeconds: 0,
        })),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      recordingConsent: {
        create: jest.fn(),
        upsert: jest.fn(),
      },
      callTranscript: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'trans-1',
          language: 'en-US',
          provider: 'default-internal',
          ...data,
          createdAt: new Date(),
        })),
        findMany: jest.fn(),
      },
      transcriptSegment: {
        create: jest.fn(),
      },
      scheduledCall: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'sched-1',
          ...data,
          createdAt: new Date(),
          reminderMinutes: 15,
        })),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      scheduledCallInvitee: {
        create: jest.fn(),
      },
      callEvent: {
        create: jest.fn(),
      },
      outboxEvent: {
        create: jest.fn(),
      },
    };

    mockStateMachine = {
      transitionCallSession: jest.fn(),
      transitionCallLeg: jest.fn(),
      transitionParticipant: jest.fn(),
      transitionInvitation: jest.fn(),
      transitionMediaSession: jest.fn(),
      transitionWaitingRoom: jest.fn(),
      transitionDeviceTransfer: jest.fn(),
      transitionRecordingSession: jest.fn(),
      transitionScheduledCall: jest.fn(),
    };

    mockAuthService = {
      assertCanAccessCall: jest.fn().mockResolvedValue(true),
      assertCanJoinCall: jest.fn().mockResolvedValue(true),
      assertCanEndCall: jest.fn().mockResolvedValue({ id: 'call-1', hostUserId: 'host-1' }),
      assertCanMuteParticipant: jest.fn().mockResolvedValue(true),
      assertCanRemoveParticipant: jest.fn().mockResolvedValue(true),
      assertCanSwapCalls: jest.fn().mockResolvedValue({
        callA: { id: 'call-active', status: 'ACTIVE' },
        callB: { id: 'call-held', status: 'HELD' },
      }),
      assertCanTransferCall: jest.fn().mockResolvedValue(true),
      assertCanMergeCalls: jest.fn().mockResolvedValue({
        callA: { id: 'call-a', roomName: 'Call A', participants: [{ userId: 'user-1' }, { userId: 'user-2' }] },
        callB: { id: 'call-b', roomName: 'Call B', participants: [{ userId: 'user-3' }] },
      }),
      assertCanModerateConference: jest.fn().mockResolvedValue(true),
      assertCanHandoffCall: jest.fn().mockResolvedValue(true),
      assertCanStartRecording: jest.fn().mockResolvedValue(true),
      assertCanAccessRecording: jest.fn().mockResolvedValue({
        id: 'rec-1',
        callSessionId: 'call-1',
        initiatorUserId: 'user-1',
      }),
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

    mockTranscriptionProvider = {
      providerName: 'default-internal',
      processAudio: jest.fn().mockResolvedValue({
        fullText: 'Welcome everyone to the NexaVoice conference.',
        segments: [
          { speakerUserId: 'user-1', speakerLabel: 'Host', startMs: 0, endMs: 2500, text: 'Welcome everyone to the NexaVoice conference.', confidence: 0.98 },
        ],
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

  describe('Call Waiting & Swap', () => {
    it('swaps active call to hold and resumes held call atomically', async () => {
      mockPrisma.callSession.findUnique.mockResolvedValue({
        id: 'call-active',
        status: 'ACTIVE',
        callType: CallType.VOICE,
        startedAt: new Date(),
        participants: [],
        legs: [],
        mediaSessions: [],
      });

      await service.swapCalls('user-1', 'call-active', 'call-held');

      expect(mockAuthService.assertCanSwapCalls).toHaveBeenCalledWith('user-1', 'call-active', 'call-held');
      expect(mockPrisma.callParticipant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { callSessionId: 'call-active', userId: 'user-1' },
          data: { isOnHold: true },
        }),
      );
      expect(mockPrisma.callParticipant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { callSessionId: 'call-held', userId: 'user-1' },
          data: { isOnHold: false },
        }),
      );
      expect(mockSignalingGateway.broadcastToCall).toHaveBeenCalledWith('call-active', 'call.status_changed', expect.any(Object));
      expect(mockSignalingGateway.broadcastToCall).toHaveBeenCalledWith('call-held', 'call.status_changed', expect.any(Object));
      expect(mockSignalingGateway.broadcastToUser).toHaveBeenCalledWith('user-1', 'call.swapped', expect.any(Object));
    });
  });

  describe('Call Transfers (Blind & Attended)', () => {
    it('executes blind transfer by ending original leg and inviting target user', async () => {
      mockPrisma.callSession.findUnique.mockResolvedValue({
        id: 'call-1',
        status: 'ACTIVE',
        callType: CallType.VOICE,
        startedAt: new Date(),
        maxParticipants: 2,
        participants: [],
        legs: [],
        mediaSessions: [],
      });

      await service.blindTransfer('user-1', 'call-1', 'user-target');

      expect(mockAuthService.assertCanTransferCall).toHaveBeenCalledWith('user-1', 'call-1', 'user-target');
      expect(mockPrisma.callTransfer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            callSessionId: 'call-1',
            initiatorUserId: 'user-1',
            targetUserId: 'user-target',
            transferType: 'BLIND',
          }),
        }),
      );
      expect(mockSignalingGateway.broadcastToUser).toHaveBeenCalledWith('user-target', 'call.incoming', expect.any(Object));
    });

    it('initiates attended transfer consultation call', async () => {
      mockPrisma.callSession.findUnique.mockResolvedValue({
        id: 'call-consult',
        status: 'NEW',
        callType: CallType.VOICE,
        conversationId: 'conv-1',
        startedAt: new Date(),
        participants: [],
        legs: [],
        mediaSessions: [],
      });

      mockPrisma.callSession.create.mockResolvedValueOnce({
        id: 'call-consult',
        callType: CallType.VOICE,
        status: CallSessionStatus.NEW,
        hostUserId: 'user-1',
        parentCallSessionId: 'call-1',
        startedAt: new Date(),
        participants: [],
        legs: [],
        mediaSessions: [],
      });

      await service.initiateAttendedTransfer('user-1', 'call-1', 'user-target');

      expect(mockAuthService.assertCanTransferCall).toHaveBeenCalledWith('user-1', 'call-1', 'user-target');
      expect(mockPrisma.callTransfer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            callSessionId: 'call-1',
            initiatorUserId: 'user-1',
            targetUserId: 'user-target',
            transferType: 'ATTENDED',
          }),
        }),
      );
    });
  });

  describe('Conferencing Merge & Split', () => {
    it('merges two calls into a single SFU conference session', async () => {
      mockPrisma.callSession.findUnique
        .mockResolvedValueOnce({
          id: 'call-a',
          status: 'ACTIVE',
          roomName: 'Call A',
          startedAt: new Date(),
          participants: [{ userId: 'user-1', joinedAt: new Date() }, { userId: 'user-2', joinedAt: new Date() }],
          legs: [],
          mediaSessions: [],
        })
        .mockResolvedValueOnce({
          id: 'call-b',
          status: 'ACTIVE',
          roomName: 'Call B',
          startedAt: new Date(),
          participants: [{ userId: 'user-1', joinedAt: new Date() }, { userId: 'user-3', joinedAt: new Date() }],
          legs: [],
          mediaSessions: [],
        })
        .mockResolvedValue({
          id: 'conf-call',
          status: 'ACTIVE',
          callType: CallType.CONFERENCE,
          roomName: 'Merged Conference',
          startedAt: new Date(),
          participants: [{ userId: 'user-1', joinedAt: new Date() }],
          legs: [],
          mediaSessions: [],
        });

      mockPrisma.callSession.create.mockResolvedValueOnce({
        id: 'conf-call',
        callType: CallType.CONFERENCE,
        status: CallSessionStatus.ACTIVE,
        hostUserId: 'user-1',
        roomName: 'Merged Conference',
        maxParticipants: 100,
        startedAt: new Date(),
        participants: [],
        legs: [],
        mediaSessions: [],
      });

      const conf = await service.mergeCalls('user-1', 'call-a', 'call-b');

      expect(mockAuthService.assertCanMergeCalls).toHaveBeenCalledWith('user-1', 'call-a', 'call-b');
      expect(mockPrisma.conferenceSession.upsert).toHaveBeenCalled();
      expect(mockStateMachine.transitionCallSession).toHaveBeenCalledWith(
        'call-b',
        expect.any(Array),
        CallSessionStatus.ENDED,
        expect.anything(),
        'MERGED_INTO_CONFERENCE',
      );
      expect(conf).toBeDefined();
    });

    it('splits a participant out from a conference into a 1:1 call', async () => {
      mockPrisma.conferenceSession.findUnique.mockResolvedValueOnce({
        id: 'conf-1',
        callSessionId: 'conf-call',
      });

      mockPrisma.callParticipant.findUnique.mockResolvedValueOnce({
        id: 'p-user-2',
        callSessionId: 'conf-1',
        userId: 'user-2',
        state: 'CONNECTED',
      });

      mockPrisma.callSession.findUnique.mockResolvedValue({
        id: 'call-private',
        callType: CallType.VOICE,
        status: CallSessionStatus.NEW,
        startedAt: new Date(),
        participants: [],
        legs: [],
        mediaSessions: [],
      });

      mockPrisma.callSession.create.mockResolvedValueOnce({
        id: 'call-private',
        callType: CallType.VOICE,
        status: CallSessionStatus.NEW,
        hostUserId: 'user-1',
        startedAt: new Date(),
        participants: [],
        legs: [],
        mediaSessions: [],
      });

      await service.splitConferenceCall('user-1', 'conf-1', 'user-2');

      expect(mockAuthService.assertCanModerateConference).toHaveBeenCalledWith('user-1', 'conf-1');
      expect(mockStateMachine.transitionParticipant).toHaveBeenCalledWith(
        'p-user-2',
        expect.any(Array),
        'REMOVED',
        expect.anything(),
      );
    });
  });

  describe('Waiting Room Management', () => {
    it('admits waiting participant and informs call room', async () => {
      await service.admitParticipant('host-1', 'call-1', 'waiting-user');

      expect(mockAuthService.assertCanModerateConference).toHaveBeenCalledWith('host-1', 'call-1');
      expect(mockStateMachine.transitionWaitingRoom).toHaveBeenCalledWith(
        'call-1',
        'waiting-user',
        [WaitingRoomState.WAITING, WaitingRoomState.JOIN_REQUESTED],
        WaitingRoomState.ADMITTED,
        'host-1',
      );
      expect(mockSignalingGateway.broadcastToUser).toHaveBeenCalledWith('waiting-user', 'call.participant.admitted', expect.any(Object));
      expect(mockSignalingGateway.broadcastToCall).toHaveBeenCalledWith('call-1', 'call.participant.admitted', expect.any(Object));
    });

    it('denies waiting participant and cleans up state', async () => {
      await service.denyParticipant('host-1', 'call-1', 'waiting-user');

      expect(mockAuthService.assertCanModerateConference).toHaveBeenCalledWith('host-1', 'call-1');
      expect(mockStateMachine.transitionWaitingRoom).toHaveBeenCalledWith(
        'call-1',
        'waiting-user',
        [WaitingRoomState.WAITING, WaitingRoomState.JOIN_REQUESTED],
        WaitingRoomState.DENIED,
        'host-1',
      );
      expect(mockSignalingGateway.broadcastToUser).toHaveBeenCalledWith('waiting-user', 'call.participant.denied', expect.any(Object));
    });
  });

  describe('Device Handoff', () => {
    it('initiates seamless device transfer request', async () => {
      const transfer = await service.initiateDeviceTransfer('user-1', 'call-1', 'device-mobile');

      expect(mockAuthService.assertCanHandoffCall).toHaveBeenCalledWith('user-1', 'call-1', 'device-mobile');
      expect(mockPrisma.callDeviceTransfer.create).toHaveBeenCalled();
      expect(mockSignalingGateway.broadcastToUser).toHaveBeenCalledWith('user-1', 'call.device_transfer.started', expect.any(Object));
      expect(transfer.status).toBe(DeviceTransferStatus.REQUESTED);
    });

    it('completes device transfer without dropping active CallSession', async () => {
      mockPrisma.callDeviceTransfer.findUnique.mockResolvedValueOnce({
        id: 'tx-1',
        userId: 'user-1',
        callSessionId: 'call-1',
        sourceDeviceId: 'device-web',
        targetDeviceId: 'device-mobile',
      });

      await service.completeDeviceTransfer('user-1', 'tx-1');

      expect(mockPrisma.callLeg.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deviceId: 'device-mobile',
            status: 'CONNECTED',
          }),
        }),
      );
      expect(mockPrisma.callLeg.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deviceId: 'device-web' }),
          data: expect.objectContaining({ status: 'ENDED' }),
        }),
      );
      expect(mockStateMachine.transitionDeviceTransfer).toHaveBeenCalledWith(
        'tx-1',
        expect.any(Array),
        DeviceTransferStatus.COMPLETED,
        undefined,
        expect.anything(),
      );
      expect(mockSignalingGateway.broadcastToUser).toHaveBeenCalledWith('user-1', 'call.device_transfer.completed', expect.any(Object));
    });
  });

  describe('Recording Lifecycle & Consent', () => {
    it('starts recording, registers consent records for all participants, and emits visual indicator', async () => {
      mockPrisma.callParticipant.findMany.mockResolvedValueOnce([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);

      const rec = await service.startRecording('user-1', 'call-1', RecordingType.COMBINED);

      expect(mockAuthService.assertCanStartRecording).toHaveBeenCalledWith('user-1', 'call-1');
      expect(mockPrisma.recordingSession.create).toHaveBeenCalled();
      expect(mockPrisma.recordingConsent.create).toHaveBeenCalledTimes(2);
      expect(mockSignalingGateway.broadcastToCall).toHaveBeenCalledWith(
        'call-1',
        'call.recording.started',
        expect.objectContaining({
          indicator: {
            isActive: true,
            isPaused: false,
            label: 'Recording in progress',
          },
        }),
      );
      expect(rec.status).toBe(RecordingStatus.RECORDING);
    });

    it('pauses and resumes recording with updated visual indicators', async () => {
      await service.pauseRecording('user-1', 'rec-1');
      expect(mockStateMachine.transitionRecordingSession).toHaveBeenCalledWith(
        'rec-1',
        [RecordingStatus.RECORDING],
        RecordingStatus.PAUSED,
      );
      expect(mockSignalingGateway.broadcastToCall).toHaveBeenCalledWith(
        'call-1',
        'call.recording.paused',
        expect.objectContaining({
          indicator: {
            isActive: true,
            isPaused: true,
            label: 'Recording paused',
          },
        }),
      );

      await service.resumeRecording('user-1', 'rec-1');
      expect(mockStateMachine.transitionRecordingSession).toHaveBeenCalledWith(
        'rec-1',
        [RecordingStatus.PAUSED],
        RecordingStatus.RECORDING,
      );
    });

    it('submits participant recording consent and broadcasts update', async () => {
      mockPrisma.recordingSession.findUnique.mockResolvedValueOnce({
        id: 'rec-1',
        callSessionId: 'call-1',
      });

      await service.submitRecordingConsent('user-2', 'rec-1', true);

      expect(mockPrisma.recordingConsent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ consentState: ConsentState.GRANTED }),
          update: expect.objectContaining({ consentState: ConsentState.GRANTED }),
        }),
      );
      expect(mockSignalingGateway.broadcastToCall).toHaveBeenCalledWith('call-1', 'call.recording.consent_updated', expect.any(Object));
    });

    it('generates secure time-limited playback URL for authorized listener', async () => {
      const url = await service.getRecordingPlaybackUrl('user-1', 'rec-1');

      expect(mockAuthService.assertCanAccessRecording).toHaveBeenCalledWith('user-1', 'rec-1');
      expect(url).toContain('https://storage.nexavoice.internal/recordings/rec-1.mp4?access_token=');
    });
  });

  describe('Scheduled Calls', () => {
    it('schedules a call and broadcasts to invitees', async () => {
      const scheduled = await service.scheduleCall('user-1', {
        title: 'Weekly Standup',
        scheduledStartTime: new Date(Date.now() + 86400000),
        timezone: 'America/New_York',
        inviteeUserIds: ['user-2', 'user-3'],
      });

      expect(mockPrisma.scheduledCall.create).toHaveBeenCalled();
      expect(mockPrisma.scheduledCallInvitee.create).toHaveBeenCalledTimes(2);
      expect(mockSignalingGateway.broadcastToUser).toHaveBeenCalledWith('user-2', 'call.scheduled', expect.any(Object));
      expect(mockSignalingGateway.broadcastToUser).toHaveBeenCalledWith('user-3', 'call.scheduled', expect.any(Object));
      expect(scheduled.title).toBe('Weekly Standup');
    });

    it('cancels scheduled call by organizer', async () => {
      mockPrisma.scheduledCall.findUnique.mockResolvedValueOnce({
        id: 'sched-1',
        organizerId: 'user-1',
        invitees: [{ userId: 'user-2' }],
      });

      await service.cancelScheduledCall('user-1', 'sched-1');

      expect(mockStateMachine.transitionScheduledCall).toHaveBeenCalledWith(
        'sched-1',
        [ScheduledCallStatus.SCHEDULED, ScheduledCallStatus.STARTING],
        ScheduledCallStatus.CANCELLED,
      );
      expect(mockSignalingGateway.broadcastToUser).toHaveBeenCalledWith('user-2', 'call.scheduled.cancelled', expect.any(Object));
    });
  });

  describe('AI Transcription & Speaker Diarization', () => {
    it('transcribes call audio and stores speaker diarization segments', async () => {
      mockPrisma.callSession.findUnique.mockResolvedValueOnce({
        id: 'call-1',
        participants: [
          { userId: 'user-1', user: { id: 'user-1', displayName: 'Host' } },
        ],
      });

      const transcript = await service.transcribeCall('user-1', 'call-1', 'rec-1');

      expect(mockTranscriptionProvider.processAudio).toHaveBeenCalledWith(
        expect.objectContaining({
          callSessionId: 'call-1',
          recordingId: 'rec-1',
        }),
      );
      expect(mockPrisma.callTranscript.create).toHaveBeenCalled();
      expect(mockPrisma.transcriptSegment.create).toHaveBeenCalled();
      expect(transcript.fullText).toBe('Welcome everyone to the NexaVoice conference.');
      expect(transcript.segments?.length).toBe(1);
    });
  });
});
