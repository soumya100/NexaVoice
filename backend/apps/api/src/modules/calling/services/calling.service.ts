import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CallStateMachineService } from './call-state-machine.service';
import { CallingAuthorizationService } from './calling-authorization.service';
import { LocalPeerMediaProvider } from '../media-provider/local-peer.media-provider';
import { SfuMediaProvider } from '../media-provider/sfu.media-provider';
import { SignalingGateway } from '../../realtime/signaling.gateway';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';
import {
  CallType,
  CallSessionStatus,
  CallLegStatus,
  ParticipantState,
  ParticipantRole,
  InvitationStatus,
  MediaSessionStatus,
  CallDirection,
  MediaMode,
  WaitingRoomState,
  ScheduledCallStatus,
  DeviceTransferStatus,
  RecordingStatus,
  RecordingType,
  ConsentState,
  TranscriptStatus,
  CallSessionSummary,
  CallParticipantSummary,
  CallLegSummary,
  MediaSessionSummary,
  ScheduledCallSummary,
  DeviceTransferSummary,
  RecordingSessionSummary,
  CallTranscriptSummary,
  IceServerConfig,
} from '@nexavoice/domain-types';
import { InitiateCallDto } from '../dto/calling.dto';
import {
  CallNotFoundException,
  CallingException,
} from '../exceptions/calling.exceptions';
import { DefaultTranscriptionProvider } from '../transcription/default-transcription.provider';

@Injectable()
export class CallingService {
  private readonly logger = new StructuredLogger('CallingService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: CallStateMachineService,
    private readonly authorizationService: CallingAuthorizationService,
    private readonly localPeerProvider: LocalPeerMediaProvider,
    private readonly sfuProvider: SfuMediaProvider,
    private readonly transcriptionProvider: DefaultTranscriptionProvider,
    @Inject(forwardRef(() => SignalingGateway))
    private readonly signalingGateway: SignalingGateway,
  ) {}

  /**
   * Initiates a new call session.
   * Atomically:
   * 1. Creates CallSession in DB
   * 2. Adds host participant (CONNECTED)
   * 3. Adds host CallLeg (CONNECTED)
   * 4. Provisions MediaSession via appropriate provider (P2P vs SFU)
   * 5. Creates CallInvitation & CallLeg for each invitee (INVITED / PENDING)
   * 6. Creates CallEvent audit record
   * 7. Atomically creates OutboxEvent ('call.created')
   * 8. Broadcasts realtime 'call.incoming' to invitees' multi-device user rooms
   */
  async initiateCall(hostUserId: string, input: InitiateCallDto): Promise<CallSessionSummary> {
    const isGroupOrRoom =
      input.callType === CallType.GROUP_VOICE ||
      input.callType === CallType.GROUP_VIDEO ||
      input.callType === CallType.CONFERENCE ||
      input.callType === CallType.PERSISTENT_ROOM;

    const mediaProvider = isGroupOrRoom ? this.sfuProvider : this.localPeerProvider;
    const mediaMode = isGroupOrRoom ? MediaMode.SFU_ROUTED : MediaMode.P2P_DIRECT;
    const maxParticipants = input.maxParticipants || (isGroupOrRoom ? 100 : 2);

    const callResult = await this.prisma.$transaction(async (tx) => {
      // 1. Create CallSession
      const call = await tx.callSession.create({
        data: {
          callType: input.callType as any,
          status: CallSessionStatus.NEW as any,
          hostUserId,
          conversationId: input.conversationId,
          roomName: input.roomName,
          maxParticipants,
          scheduledStartTime: input.scheduledStartTime,
          timezone: input.timezone,
          metadataJson: input.metadata ? JSON.stringify(input.metadata) : '{}',
        },
      });

      // 2. Add Host Participant
      const hostParticipant = await tx.callParticipant.create({
        data: {
          callSessionId: call.id,
          userId: hostUserId,
          role: ParticipantRole.HOST as any,
          state: ParticipantState.CONNECTED as any,
          canMuteOthers: true,
          canRemoveParticipants: true,
          canInviteParticipants: true,
          canShareScreen: true,
          canRecord: true,
          canEndCall: true,
        },
      });

      // 3. Add Host CallLeg
      await tx.callLeg.create({
        data: {
          callSessionId: call.id,
          participantId: hostParticipant.id,
          userId: hostUserId,
          direction: CallDirection.OUTBOUND as any,
          status: CallLegStatus.CONNECTED as any,
          connectedAt: new Date(),
        },
      });

      // 4. Provision MediaSession
      const mediaResult = await mediaProvider.createSession(call.id, {
        mode: mediaMode,
        roomName: input.roomName,
        maxParticipants,
      });

      await tx.mediaSession.create({
        data: {
          callSessionId: call.id,
          provider: mediaResult.provider,
          mode: mediaResult.mode as any,
          status: MediaSessionStatus.INITIALIZING as any,
          sfuRoomId: mediaResult.sfuRoomId,
          iceServersJson: JSON.stringify(mediaResult.iceServers),
        },
      });

      // 5. Create invitations & legs for invitees
      const expiresAt = new Date(Date.now() + 60 * 1000); // 60s timeout for ringing
      for (const inviteeId of input.inviteeUserIds) {
        if (inviteeId === hostUserId) continue;

        const participant = await tx.callParticipant.create({
          data: {
            callSessionId: call.id,
            userId: inviteeId,
            role: ParticipantRole.PARTICIPANT as any,
            state: ParticipantState.INVITED as any,
            canMuteOthers: false,
            canRemoveParticipants: false,
            canInviteParticipants: true,
            canShareScreen: true,
            canRecord: false,
            canEndCall: false,
          },
        });

        await tx.callInvitation.create({
          data: {
            callSessionId: call.id,
            inviterId: hostUserId,
            inviteeId,
            status: InvitationStatus.PENDING as any,
            expiresAt,
          },
        });

        await tx.callLeg.create({
          data: {
            callSessionId: call.id,
            participantId: participant.id,
            userId: inviteeId,
            direction: CallDirection.INBOUND as any,
            status: CallLegStatus.INVITED as any,
          },
        });
      }

      // 6. Record Audit CallEvent
      await tx.callEvent.create({
        data: {
          callSessionId: call.id,
          actorId: hostUserId,
          eventType: 'SESSION_CREATED',
          payloadJson: JSON.stringify({
            callType: input.callType,
            invitees: input.inviteeUserIds,
          }),
        },
      });

      // 7. If linked to a conversation, emit CALL_EVENT message
      if (input.conversationId) {
        await tx.message.create({
          data: {
            conversationId: input.conversationId,
            senderId: hostUserId,
            type: 'CALL_EVENT' as any,
            content: JSON.stringify({
              event: 'CALL_STARTED',
              callId: call.id,
              callType: input.callType,
            }),
            deliveryStatus: 'DELIVERED' as any,
          },
        });
      }

      // 8. Transactional Outbox Event
      await tx.outboxEvent.create({
        data: {
          eventType: 'call.created',
          aggregateType: 'CallSession',
          aggregateId: call.id,
          payloadJson: JSON.stringify({
            callId: call.id,
            hostUserId,
            callType: input.callType,
            inviteeUserIds: input.inviteeUserIds,
            conversationId: input.conversationId,
          }),
          status: 'PENDING',
          correlationId: call.id,
        },
      });

      return call.id;
    });

    // 8. Fetch complete call summary
    const summary = await this.getCall(hostUserId, callResult);

    // 9. Emit realtime events to invitees across all their active devices
    for (const inviteeId of input.inviteeUserIds) {
      if (inviteeId === hostUserId) continue;

      const existingActive = await this.prisma.callSession.findFirst({
        where: {
          status: 'ACTIVE',
          participants: {
            some: {
              userId: inviteeId,
              state: { in: ['CONNECTED', 'JOINED'] },
            },
          },
        },
      });

      if (existingActive) {
        this.signalingGateway.broadcastToUser(inviteeId, 'call.waiting', {
          call: summary,
          activeCallId: existingActive.id,
          hostUserId,
          callType: input.callType,
          timestamp: new Date().toISOString(),
        });
      }

      this.signalingGateway.broadcastToUser(inviteeId, 'call.incoming', {
        call: summary,
        hostUserId,
        callType: input.callType,
        isWaiting: !!existingActive,
        timestamp: new Date().toISOString(),
      });
    }

    this.logger.log({
      event: 'call_session_initiated',
      callId: callResult,
      hostUserId,
      inviteeCount: input.inviteeUserIds.length,
    });

    return summary;
  }

  /**
   * Accepts an incoming call.
   * If user currently has another active call, automatically transitions that call to HELD.
   */
  async acceptCall(userId: string, callId: string, _deviceId?: string): Promise<CallSessionSummary> {
    const call = await this.prisma.callSession.findUnique({
      where: { id: callId },
      include: {
        participants: true,
        invitations: {
          where: { inviteeId: userId },
        },
      },
    });

    if (!call) {
      throw new CallNotFoundException(callId);
    }

    if (call.status === 'ENDED' || call.status === 'FAILED' || call.status === 'MISSED' || call.status === 'REJECTED') {
      throw new CallingException(`Cannot accept call in terminal state '${call.status}'`);
    }

    // Auto-hold any other call currently in ACTIVE state for this user (Call Waiting semantics)
    const existingActive = await this.prisma.callSession.findFirst({
      where: {
        id: { not: callId },
        status: 'ACTIVE',
        participants: {
          some: {
            userId,
            state: { in: ['CONNECTED', 'JOINED'] },
          },
        },
      },
    });

    if (existingActive) {
      await this.holdCall(userId, existingActive.id);
    }

    const invitation = call.invitations[0];
    const participant = call.participants.find((p) => p.userId === userId);

    if (!participant) {
      throw new CallingException('User is not a participant in this call');
    }

    // Atomic acceptance in DB
    await this.prisma.$transaction(async (tx) => {
      // 1. Transition Invitation if exists
      if (invitation) {
        await this.stateMachine.transitionInvitation(
          invitation.id,
          [InvitationStatus.PENDING, InvitationStatus.RINGING],
          InvitationStatus.ACCEPTED,
          tx,
        );
      }

      // 2. Transition Participant to CONNECTED
      await this.stateMachine.transitionParticipant(
        participant.id,
        [ParticipantState.INVITED, ParticipantState.RINGING, ParticipantState.JOINING],
        ParticipantState.CONNECTED,
        tx,
      );

      // 3. Transition Participant Leg to CONNECTED
      const leg = await tx.callLeg.findFirst({
        where: { callSessionId: callId, userId },
      });
      if (leg) {
        await this.stateMachine.transitionCallLeg(
          leg.id,
          [CallLegStatus.CREATED, CallLegStatus.INVITED, CallLegStatus.RINGING, CallLegStatus.CONNECTING],
          CallLegStatus.CONNECTED,
          tx,
        );
      }

      // 4. Transition CallSession to ACTIVE if not already active
      if (call.status !== 'ACTIVE') {
        await this.stateMachine.transitionCallSession(
          callId,
          [CallSessionStatus.NEW, CallSessionStatus.RINGING, CallSessionStatus.CONNECTING],
          CallSessionStatus.ACTIVE,
          tx,
        );
      }

      // 5. Audit Event
      await tx.callEvent.create({
        data: {
          callSessionId: callId,
          actorId: userId,
          eventType: 'INVITATION_ACCEPTED',
          payloadJson: JSON.stringify({ userId }),
        },
      });

      // 6. Outbox Event
      await tx.outboxEvent.create({
        data: {
          eventType: 'call.accepted',
          aggregateType: 'CallSession',
          aggregateId: callId,
          payloadJson: JSON.stringify({ callId, userId }),
          status: 'PENDING',
          correlationId: callId,
        },
      });
    });

    const summary = await this.getCall(userId, callId);

    // Cancel ringing across other devices of accepting user (multi-device)
    this.signalingGateway.broadcastToUser(userId, 'call.ringing.cancelled', {
      callId,
      acceptedByDevice: true,
    });

    // Notify call room and host
    this.signalingGateway.broadcastToCall(callId, 'call.accepted', {
      callId,
      userId,
      call: summary,
      timestamp: new Date().toISOString(),
    });

    return summary;
  }

  /**
   * Declines an incoming call.
   */
  async declineCall(userId: string, callId: string, reason?: string): Promise<void> {
    const call = await this.prisma.callSession.findUnique({
      where: { id: callId },
      include: {
        participants: true,
        invitations: true,
      },
    });

    if (!call) {
      throw new CallNotFoundException(callId);
    }

    const invitation = call.invitations.find((i) => i.inviteeId === userId);
    const participant = call.participants.find((p) => p.userId === userId);

    if (invitation) {
      await this.stateMachine.transitionInvitation(
        invitation.id,
        [InvitationStatus.PENDING, InvitationStatus.RINGING],
        InvitationStatus.DECLINED,
      );
    }

    if (participant) {
      await this.stateMachine.transitionParticipant(
        participant.id,
        [ParticipantState.INVITED, ParticipantState.RINGING, ParticipantState.JOINING],
        ParticipantState.DECLINED,
      );
    }

    // If 1:1 call, decline ends the call
    if (call.participants.length <= 2) {
      await this.stateMachine.transitionCallSession(
        callId,
        [CallSessionStatus.NEW, CallSessionStatus.RINGING, CallSessionStatus.CONNECTING],
        CallSessionStatus.REJECTED,
        undefined,
        reason || 'DECLINED_BY_RECEIVER',
      );
    }

    this.signalingGateway.broadcastToCall(callId, 'call.declined', {
      callId,
      userId,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Cancels a ringing/outgoing call by host.
   */
  async cancelCall(hostUserId: string, callId: string): Promise<void> {
    const call = await this.authorizationService.assertCanEndCall(hostUserId, callId);

    if (call.status === 'ENDED' || call.status === 'FAILED' || call.status === 'MISSED' || call.status === 'REJECTED') {
      return; // Already terminal
    }

    await this.stateMachine.transitionCallSession(
      callId,
      [CallSessionStatus.NEW, CallSessionStatus.RINGING, CallSessionStatus.CONNECTING],
      CallSessionStatus.MISSED,
      undefined,
      'CANCELLED_BY_HOST',
    );

    // Cancel all pending invitations
    await this.prisma.callInvitation.updateMany({
      where: { callSessionId: callId, status: 'PENDING' },
      data: { status: 'CANCELED' },
    });

    this.signalingGateway.broadcastToCall(callId, 'call.cancelled', {
      callId,
      timestamp: new Date().toISOString(),
    });

    this.signalingGateway.evictAllFromCall(callId, 'CALL_CANCELLED');
  }

  /**
   * Joins an active call session. Zero-trust server authorized.
   */
  async joinCall(userId: string, callId: string, deviceId?: string): Promise<CallSessionSummary> {
    await this.authorizationService.assertCanJoinCall(userId, callId);

    let participant = await this.prisma.callParticipant.findUnique({
      where: { callSessionId_userId: { callSessionId: callId, userId } },
    });

    await this.prisma.$transaction(async (tx) => {
      if (!participant) {
        participant = await tx.callParticipant.create({
          data: {
            callSessionId: callId,
            userId,
            role: ParticipantRole.PARTICIPANT as any,
            state: ParticipantState.CONNECTED as any,
            canMuteOthers: false,
            canRemoveParticipants: false,
            canInviteParticipants: true,
            canShareScreen: true,
          },
        });
      } else {
        await this.stateMachine.transitionParticipant(
          participant.id,
          [ParticipantState.INVITED, ParticipantState.RINGING, ParticipantState.JOINING, ParticipantState.DISCONNECTED],
          ParticipantState.CONNECTED,
          tx,
        );
      }

      await tx.callLeg.create({
        data: {
          callSessionId: callId,
          participantId: participant.id,
          userId,
          deviceId,
          direction: CallDirection.INBOUND as any,
          status: CallLegStatus.CONNECTED as any,
          connectedAt: new Date(),
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'call.participant.joined',
          aggregateType: 'CallSession',
          aggregateId: callId,
          payloadJson: JSON.stringify({ callId, userId }),
          status: 'PENDING',
          correlationId: callId,
        },
      });
    });

    const summary = await this.getCall(userId, callId);

    this.signalingGateway.broadcastToCall(callId, 'call.participant.joined', {
      callId,
      userId,
      call: summary,
      timestamp: new Date().toISOString(),
    });

    return summary;
  }

  /**
   * Leaves a call session.
   */
  async leaveCall(userId: string, callId: string): Promise<void> {
    const participant = await this.prisma.callParticipant.findUnique({
      where: { callSessionId_userId: { callSessionId: callId, userId } },
    });

    if (!participant) return;

    await this.prisma.$transaction(async (tx) => {
      await this.stateMachine.transitionParticipant(
        participant.id,
        [ParticipantState.CONNECTED, ParticipantState.JOINED, ParticipantState.MUTED, ParticipantState.ON_HOLD],
        ParticipantState.LEFT,
        tx,
      );

      await tx.callLeg.updateMany({
        where: { callSessionId: callId, userId, status: 'CONNECTED' },
        data: { status: 'ENDED', endedAt: new Date() },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'call.participant.left',
          aggregateType: 'CallSession',
          aggregateId: callId,
          payloadJson: JSON.stringify({ callId, userId }),
          status: 'PENDING',
          correlationId: callId,
        },
      });
    });

    this.signalingGateway.broadcastToCall(callId, 'call.participant.left', {
      callId,
      userId,
      timestamp: new Date().toISOString(),
    });

    // Check if any participants remain active
    const activeRemaining = await this.prisma.callParticipant.count({
      where: {
        callSessionId: callId,
        state: { in: ['CONNECTED', 'JOINED', 'MUTED', 'ON_HOLD'] },
      },
    });

    if (activeRemaining === 0) {
      await this.endCall(userId, callId, 'ALL_PARTICIPANTS_LEFT');
    }
  }

  /**
   * Ends a call session. Zero-trust authorized (host or moderator).
   */
  async endCall(actorId: string, callId: string, reason?: string): Promise<void> {
    await this.authorizationService.assertCanEndCall(actorId, callId);

    const call = await this.prisma.callSession.findUnique({
      where: { id: callId },
    });

    if (!call || call.status === 'ENDED' || call.status === 'FAILED' || call.status === 'MISSED' || call.status === 'REJECTED') {
      return; // Already terminated
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Transition CallSession to ENDED
      await this.stateMachine.transitionCallSession(
        callId,
        [
          CallSessionStatus.NEW,
          CallSessionStatus.RINGING,
          CallSessionStatus.CONNECTING,
          CallSessionStatus.ACTIVE,
          CallSessionStatus.HELD,
          CallSessionStatus.INTERRUPTED,
          CallSessionStatus.ENDING,
        ],
        CallSessionStatus.ENDED,
        tx,
        reason || 'NORMAL_CLEARING',
      );

      // 2. Mark remaining active participants as LEFT
      await tx.callParticipant.updateMany({
        where: {
          callSessionId: callId,
          state: { in: ['CONNECTED', 'JOINED', 'MUTED', 'ON_HOLD', 'RINGING', 'INVITED'] },
        },
        data: {
          state: 'LEFT',
          leftAt: new Date(),
        },
      });

      // 3. Mark active legs as ENDED
      await tx.callLeg.updateMany({
        where: {
          callSessionId: callId,
          status: { in: ['CREATED', 'INVITED', 'RINGING', 'CONNECTING', 'CONNECTED', 'HELD'] },
        },
        data: {
          status: 'ENDED',
          endedAt: new Date(),
        },
      });

      // 4. Close MediaSession
      await tx.mediaSession.updateMany({
        where: { callSessionId: callId, status: { not: 'CLOSED' } },
        data: { status: 'CLOSED', closedAt: new Date() },
      });

      // 5. If linked to a conversation, emit CALL_EVENT message
      if (call.conversationId) {
        const durationSeconds = call.startedAt
          ? Math.max(0, Math.round((Date.now() - new Date(call.startedAt).getTime()) / 1000))
          : 0;
        await tx.message.create({
          data: {
            conversationId: call.conversationId,
            senderId: actorId,
            type: 'CALL_EVENT' as any,
            content: JSON.stringify({
              event: 'CALL_ENDED',
              callId: call.id,
              durationSeconds,
              reason: reason || 'NORMAL_CLEARING',
            }),
            deliveryStatus: 'DELIVERED' as any,
          },
        });
      }

      // 6. Outbox Event
      await tx.outboxEvent.create({
        data: {
          eventType: 'call.ended',
          aggregateType: 'CallSession',
          aggregateId: callId,
          payloadJson: JSON.stringify({
            callId,
            actorId,
            reason,
            conversationId: call.conversationId,
          }),
          status: 'PENDING',
          correlationId: callId,
        },
      });
    });

    // Evict all participants from socket call room
    this.signalingGateway.evictAllFromCall(callId, reason || 'CALL_ENDED');
  }

  /**
   * Mutes or unmutes audio/video of a participant. Zero-trust server authorized.
   */
  async muteParticipant(
    actorId: string,
    callId: string,
    targetUserId: string,
    isAudioMuted?: boolean,
    isVideoMuted?: boolean,
  ): Promise<void> {
    await this.authorizationService.assertCanMuteParticipant(actorId, callId, targetUserId);

    const updateData: { isAudioMuted?: boolean; isVideoMuted?: boolean } = {};
    if (isAudioMuted !== undefined) updateData.isAudioMuted = isAudioMuted;
    if (isVideoMuted !== undefined) updateData.isVideoMuted = isVideoMuted;

    await this.prisma.callParticipant.update({
      where: { callSessionId_userId: { callSessionId: callId, userId: targetUserId } },
      data: updateData,
    });

    this.signalingGateway.broadcastToCall(callId, 'call.participant.muted', {
      callId,
      actorId,
      targetUserId,
      isAudioMuted,
      isVideoMuted,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Removes a participant from the call and evicts them immediately. Zero-trust server authorized.
   */
  async removeParticipant(
    actorId: string,
    callId: string,
    targetUserId: string,
    reason?: string,
  ): Promise<void> {
    await this.authorizationService.assertCanRemoveParticipant(actorId, callId, targetUserId);

    const participant = await this.prisma.callParticipant.findUnique({
      where: { callSessionId_userId: { callSessionId: callId, userId: targetUserId } },
    });

    if (!participant) return;

    await this.prisma.$transaction(async (tx) => {
      await this.stateMachine.transitionParticipant(
        participant.id,
        [ParticipantState.CONNECTED, ParticipantState.JOINED, ParticipantState.MUTED, ParticipantState.ON_HOLD, ParticipantState.RINGING, ParticipantState.INVITED],
        ParticipantState.REMOVED,
        tx,
      );

      await tx.callLeg.updateMany({
        where: { callSessionId: callId, userId: targetUserId, status: 'CONNECTED' },
        data: { status: 'ENDED', endedAt: new Date() },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'call.participant.removed',
          aggregateType: 'CallSession',
          aggregateId: callId,
          payloadJson: JSON.stringify({ callId, actorId, targetUserId, reason }),
          status: 'PENDING',
          correlationId: callId,
        },
      });
    });

    // Zero-trust eviction from Socket.IO call room
    this.signalingGateway.evictUserFromCall(targetUserId, callId, reason || 'REMOVED_BY_MODERATOR');

    this.signalingGateway.broadcastToCall(callId, 'call.participant.removed', {
      callId,
      actorId,
      targetUserId,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Puts call on hold.
   * Atomically sets CallSession to HELD, participant isOnHold to true, leg to HELD,
   * emits outbox event, and notifies call room via Socket.IO.
   */
  async holdCall(userId: string, callId: string): Promise<void> {
    await this.authorizationService.assertCanAccessCall(userId, callId);

    await this.prisma.$transaction(async (tx) => {
      await this.stateMachine.transitionCallSession(
        callId,
        [CallSessionStatus.ACTIVE],
        CallSessionStatus.HELD,
        tx,
      );

      await tx.callParticipant.updateMany({
        where: { callSessionId: callId, userId },
        data: { isOnHold: true },
      });

      await tx.callLeg.updateMany({
        where: { callSessionId: callId, userId, status: 'CONNECTED' },
        data: { status: 'HELD' },
      });

      await tx.callEvent.create({
        data: {
          callSessionId: callId,
          actorId: userId,
          eventType: 'CALL_HELD',
          payloadJson: JSON.stringify({ userId }),
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'call.held',
          aggregateType: 'CallSession',
          aggregateId: callId,
          payloadJson: JSON.stringify({ callId, userId }),
          status: 'PENDING',
          correlationId: callId,
        },
      });
    });

    this.signalingGateway.broadcastToCall(callId, 'call.held', {
      callId,
      heldBy: userId,
      timestamp: new Date().toISOString(),
    });
    this.signalingGateway.broadcastToUser(userId, 'call.held', {
      callId,
      heldBy: userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Resumes call from hold.
   * If another call is currently active, holds it first to enforce maximum of 1 active call.
   */
  async resumeCall(userId: string, callId: string): Promise<void> {
    await this.authorizationService.assertCanAccessCall(userId, callId);

    // If another call is currently active, put it on hold first
    const otherActive = await this.prisma.callSession.findFirst({
      where: {
        id: { not: callId },
        status: 'ACTIVE',
        participants: {
          some: {
            userId,
            state: { in: ['CONNECTED', 'JOINED'] },
          },
        },
      },
    });

    if (otherActive) {
      await this.holdCall(userId, otherActive.id);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.stateMachine.transitionCallSession(
        callId,
        [CallSessionStatus.HELD],
        CallSessionStatus.ACTIVE,
        tx,
      );

      await tx.callParticipant.updateMany({
        where: { callSessionId: callId, userId },
        data: { isOnHold: false },
      });

      await tx.callLeg.updateMany({
        where: { callSessionId: callId, userId, status: 'HELD' },
        data: { status: 'CONNECTED' },
      });

      await tx.callEvent.create({
        data: {
          callSessionId: callId,
          actorId: userId,
          eventType: 'CALL_RESUMED',
          payloadJson: JSON.stringify({ userId }),
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'call.resumed',
          aggregateType: 'CallSession',
          aggregateId: callId,
          payloadJson: JSON.stringify({ callId, userId }),
          status: 'PENDING',
          correlationId: callId,
        },
      });
    });

    this.signalingGateway.broadcastToCall(callId, 'call.resumed', {
      callId,
      resumedBy: userId,
      timestamp: new Date().toISOString(),
    });
    this.signalingGateway.broadcastToUser(userId, 'call.resumed', {
      callId,
      resumedBy: userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Swaps between an ACTIVE call and a HELD call atomically.
   */
  async swapCalls(
    userId: string,
    callAId: string,
    callBId: string,
  ): Promise<{ callA: CallSessionSummary; callB: CallSessionSummary }> {
    const { callA } = await this.authorizationService.assertCanSwapCalls(userId, callAId, callBId);

    const activeCallId = callA.status === 'ACTIVE' ? callAId : callBId;
    const heldCallId = callA.status === 'ACTIVE' ? callBId : callAId;

    await this.prisma.$transaction(async (tx) => {
      // 1. Transition Active -> Held
      await this.stateMachine.transitionCallSession(
        activeCallId,
        [CallSessionStatus.ACTIVE],
        CallSessionStatus.HELD,
        tx,
      );
      await tx.callParticipant.updateMany({
        where: { callSessionId: activeCallId, userId },
        data: { isOnHold: true },
      });
      await tx.callLeg.updateMany({
        where: { callSessionId: activeCallId, userId, status: 'CONNECTED' },
        data: { status: 'HELD' },
      });

      // 2. Transition Held -> Active
      await this.stateMachine.transitionCallSession(
        heldCallId,
        [CallSessionStatus.HELD],
        CallSessionStatus.ACTIVE,
        tx,
      );
      await tx.callParticipant.updateMany({
        where: { callSessionId: heldCallId, userId },
        data: { isOnHold: false },
      });
      await tx.callLeg.updateMany({
        where: { callSessionId: heldCallId, userId, status: 'HELD' },
        data: { status: 'CONNECTED' },
      });

      // 3. Outbox Event
      await tx.outboxEvent.create({
        data: {
          eventType: 'call.swapped',
          aggregateType: 'CallSession',
          aggregateId: activeCallId,
          payloadJson: JSON.stringify({ userId, heldCallId: activeCallId, activeCallId: heldCallId }),
          status: 'PENDING',
          correlationId: activeCallId,
        },
      });
    });

    const [summaryA, summaryB] = await Promise.all([
      this.getCall(userId, callAId),
      this.getCall(userId, callBId),
    ]);

    this.signalingGateway.broadcastToUser(userId, 'call.swapped', {
      heldCallId: activeCallId,
      activeCallId: heldCallId,
      timestamp: new Date().toISOString(),
    });
    this.signalingGateway.broadcastToCall(callAId, 'call.status_changed', { call: summaryA });
    this.signalingGateway.broadcastToCall(callBId, 'call.status_changed', { call: summaryB });

    return { callA: summaryA, callB: summaryB };
  }

  /**
   * Blind transfer: Initiator introduces target user and leaves communication path.
   */
  async blindTransfer(userId: string, callId: string, targetUserId: string): Promise<void> {
    await this.authorizationService.assertCanTransferCall(userId, callId, targetUserId);

    await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.callTransfer.create({
        data: {
          callSessionId: callId,
          initiatorUserId: userId,
          targetUserId,
          transferType: 'BLIND',
          status: 'INITIATED',
        },
      });

      const participant = await tx.callParticipant.create({
        data: {
          callSessionId: callId,
          userId: targetUserId,
          role: ParticipantRole.PARTICIPANT as any,
          state: ParticipantState.INVITED as any,
        },
      });

      await tx.callInvitation.create({
        data: {
          callSessionId: callId,
          inviterId: userId,
          inviteeId: targetUserId,
          status: InvitationStatus.PENDING as any,
          expiresAt: new Date(Date.now() + 60 * 1000),
        },
      });

      await tx.callLeg.create({
        data: {
          callSessionId: callId,
          participantId: participant.id,
          userId: targetUserId,
          direction: CallDirection.INBOUND as any,
          status: CallLegStatus.INVITED as any,
        },
      });

      await tx.callTransfer.update({
        where: { id: transfer.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'call.transfer.completed',
          aggregateType: 'CallSession',
          aggregateId: callId,
          payloadJson: JSON.stringify({ callId, initiatorUserId: userId, targetUserId, transferType: 'BLIND' }),
          status: 'PENDING',
          correlationId: callId,
        },
      });
    });

    const summary = await this.getCall(userId, callId);

    this.signalingGateway.broadcastToUser(targetUserId, 'call.incoming', {
      call: summary,
      hostUserId: userId,
      callType: summary.callType,
      isTransfer: true,
      timestamp: new Date().toISOString(),
    });

    await this.leaveCall(userId, callId);
  }

  /**
   * Attended transfer: Initiates a separate consultation call while holding original call.
   */
  async initiateAttendedTransfer(
    userId: string,
    callId: string,
    targetUserId: string,
  ): Promise<{ transferId: string; consultCall: CallSessionSummary }> {
    await this.authorizationService.assertCanTransferCall(userId, callId, targetUserId);

    // 1. Put primary call on hold
    await this.holdCall(userId, callId);

    // 2. Initiate separate consultation call with lineage
    const consultCall = await this.initiateCall(userId, {
      callType: CallType.VOICE,
      inviteeUserIds: [targetUserId],
    });

    await this.prisma.callSession.update({
      where: { id: consultCall.id },
      data: { parentCallSessionId: callId },
    });

    const transfer = await this.prisma.callTransfer.create({
      data: {
        callSessionId: callId,
        initiatorUserId: userId,
        targetUserId,
        transferType: 'ATTENDED',
        status: 'CONSULTING',
      },
    });

    return { transferId: transfer.id, consultCall };
  }

  /**
   * Completes an attended transfer by bridging the remote participants.
   */
  async completeAttendedTransfer(userId: string, transferId: string): Promise<void> {
    const transfer = await this.prisma.callTransfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer || transfer.initiatorUserId !== userId) {
      throw new CallingException('Transfer not found or unauthorized');
    }

    await this.prisma.callTransfer.update({
      where: { id: transferId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // Leave both original and consult calls
    await this.leaveCall(userId, transfer.callSessionId);
  }

  /**
   * Cancels an attended transfer, returning to original call.
   */
  async cancelAttendedTransfer(userId: string, transferId: string): Promise<void> {
    const transfer = await this.prisma.callTransfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer || transfer.initiatorUserId !== userId) {
      throw new CallingException('Transfer not found or unauthorized');
    }

    await this.prisma.callTransfer.update({
      where: { id: transferId },
      data: { status: 'CANCELLED' },
    });

    // Resume original call
    await this.resumeCall(userId, transfer.callSessionId);
  }

  /**
   * Merges two separate call sessions into a single conference session.
   */
  async mergeCalls(
    userId: string,
    callAId: string,
    callBId: string,
    title?: string,
  ): Promise<CallSessionSummary> {
    const { callA, callB, combinedUserIds } = await this.authorizationService.assertCanMergeCalls(
      userId,
      callAId,
      callBId,
    );

    await this.prisma.$transaction(async (tx) => {
      // 1. Promote Call A to CONFERENCE
      await tx.callSession.update({
        where: { id: callAId },
        data: {
          callType: CallType.CONFERENCE as any,
          status: CallSessionStatus.ACTIVE as any,
          maxParticipants: 100,
        },
      });

      // 2. Create or link ConferenceSession
      await tx.conferenceSession.upsert({
        where: { callSessionId: callAId },
        create: {
          callSessionId: callAId,
          title: title || `Conference (${callA.roomName || 'Merged Call'})`,
          maxParticipants: 100,
        },
        update: {
          title: title || `Conference (${callA.roomName || 'Merged Call'})`,
        },
      });

      // 3. Move all participants from Call B into Call A
      for (const p of callB.participants) {
        const existingInA = await tx.callParticipant.findUnique({
          where: { callSessionId_userId: { callSessionId: callAId, userId: p.userId } },
        });

        if (!existingInA) {
          await tx.callParticipant.create({
            data: {
              callSessionId: callAId,
              userId: p.userId,
              role: ParticipantRole.PARTICIPANT as any,
              state: ParticipantState.CONNECTED as any,
              isOnHold: false,
              canShareScreen: true,
            },
          });

          await tx.callLeg.create({
            data: {
              callSessionId: callAId,
              userId: p.userId,
              direction: CallDirection.INBOUND as any,
              status: CallLegStatus.CONNECTED as any,
            },
          });
        }
      }

      // 4. Update MediaSession of Call A to SFU_ROUTED
      await tx.mediaSession.updateMany({
        where: { callSessionId: callAId },
        data: { mode: MediaMode.SFU_ROUTED as any },
      });

      // 5. Terminate Call B with MERGED_INTO_CONFERENCE
      await this.stateMachine.transitionCallSession(
        callBId,
        [CallSessionStatus.ACTIVE, CallSessionStatus.HELD],
        CallSessionStatus.ENDED,
        tx,
        'MERGED_INTO_CONFERENCE',
      );

      await tx.callSession.update({
        where: { id: callBId },
        data: { parentCallSessionId: callAId },
      });

      // 6. Outbox Event
      await tx.outboxEvent.create({
        data: {
          eventType: 'call.conference.created',
          aggregateType: 'CallSession',
          aggregateId: callAId,
          payloadJson: JSON.stringify({ conferenceCallId: callAId, mergedCallId: callBId, combinedUserIds }),
          status: 'PENDING',
          correlationId: callAId,
        },
      });
    });

    const summary = await this.getCall(userId, callAId);

    this.signalingGateway.broadcastToCall(callAId, 'call.merged', {
      call: summary,
      conferenceCallId: callAId,
      timestamp: new Date().toISOString(),
    });
    this.signalingGateway.broadcastToCall(callBId, 'call.merged', {
      call: summary,
      conferenceCallId: callAId,
      timestamp: new Date().toISOString(),
    });

    return summary;
  }

  /**
   * Splits a participant from a conference call into an isolated session.
   */
  async splitConferenceCall(
    userId: string,
    callId: string,
    targetUserId: string,
  ): Promise<CallSessionSummary> {
    await this.authorizationService.assertCanModerateConference(userId, callId);

    // Remove target from conference
    await this.removeParticipant(userId, callId, targetUserId, 'SPLIT_FROM_CONFERENCE');

    // Create new 1:1 call with target
    const newCall = await this.initiateCall(userId, {
      callType: CallType.VOICE,
      inviteeUserIds: [targetUserId],
    });

    await this.prisma.callSession.update({
      where: { id: newCall.id },
      data: { parentCallSessionId: callId },
    });

    return newCall;
  }

  /**
   * Admits a participant from the waiting room into the call.
   */
  async admitParticipant(moderatorUserId: string, callId: string, targetUserId: string): Promise<void> {
    await this.authorizationService.assertCanModerateConference(moderatorUserId, callId);

    await this.stateMachine.transitionWaitingRoom(
      callId,
      targetUserId,
      [WaitingRoomState.WAITING, WaitingRoomState.JOIN_REQUESTED],
      WaitingRoomState.ADMITTED,
      moderatorUserId,
    );

    this.signalingGateway.broadcastToCall(callId, 'call.participant.admitted', {
      callId,
      targetUserId,
      admittedBy: moderatorUserId,
      timestamp: new Date().toISOString(),
    });
    this.signalingGateway.broadcastToUser(targetUserId, 'call.participant.admitted', {
      callId,
      admittedBy: moderatorUserId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Denies a participant from the waiting room.
   */
  async denyParticipant(moderatorUserId: string, callId: string, targetUserId: string): Promise<void> {
    await this.authorizationService.assertCanModerateConference(moderatorUserId, callId);

    await this.stateMachine.transitionWaitingRoom(
      callId,
      targetUserId,
      [WaitingRoomState.WAITING, WaitingRoomState.JOIN_REQUESTED],
      WaitingRoomState.DENIED,
      moderatorUserId,
    );

    this.signalingGateway.broadcastToUser(targetUserId, 'call.participant.denied', {
      callId,
      deniedBy: moderatorUserId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Locks or unlocks a conference room.
   */
  async lockConference(moderatorUserId: string, callId: string, isLocked: boolean): Promise<void> {
    await this.authorizationService.assertCanModerateConference(moderatorUserId, callId);

    await this.prisma.conferenceSession.updateMany({
      where: { callSessionId: callId },
      data: { isLocked },
    });

    this.signalingGateway.broadcastToCall(callId, 'call.conference.locked', {
      callId,
      isLocked,
      moderatorUserId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Starts screen sharing for a participant.
   */
  async startScreenShare(userId: string, callId: string): Promise<void> {
    const call = await this.authorizationService.assertCanAccessCall(userId, callId);

    if (call.screenSharerUserId && call.screenSharerUserId !== userId) {
      throw new CallingException('Another participant is already sharing their screen');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.callSession.update({
        where: { id: callId },
        data: { screenSharerUserId: userId },
      });

      await tx.callParticipant.updateMany({
        where: { callSessionId: callId, userId },
        data: { isScreenSharing: true },
      });
    });

    this.signalingGateway.broadcastToCall(callId, 'call.screenshare.started', {
      callId,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Stops screen sharing for a participant.
   */
  async stopScreenShare(userId: string, callId: string): Promise<void> {
    await this.authorizationService.assertCanAccessCall(userId, callId);

    await this.prisma.$transaction(async (tx) => {
      await tx.callSession.update({
        where: { id: callId },
        data: { screenSharerUserId: null },
      });

      await tx.callParticipant.updateMany({
        where: { callSessionId: callId, userId },
        data: { isScreenSharing: false },
      });
    });

    this.signalingGateway.broadcastToCall(callId, 'call.screenshare.stopped', {
      callId,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Initiates a seamless device handoff for the active user.
   */
  async initiateDeviceTransfer(
    userId: string,
    callId: string,
    targetDeviceId: string,
  ): Promise<DeviceTransferSummary> {
    await this.authorizationService.assertCanHandoffCall(userId, callId, targetDeviceId);

    const sourceLeg = await this.prisma.callLeg.findFirst({
      where: { callSessionId: callId, userId, status: 'CONNECTED' },
    });

    const sourceDeviceId = sourceLeg?.deviceId || 'primary-device';

    const transfer = await this.prisma.callDeviceTransfer.create({
      data: {
        callSessionId: callId,
        userId,
        sourceDeviceId,
        targetDeviceId,
        status: DeviceTransferStatus.REQUESTED as any,
      },
    });

    this.signalingGateway.broadcastToUser(userId, 'call.device_transfer.started', {
      transferId: transfer.id,
      callId,
      sourceDeviceId,
      targetDeviceId,
      timestamp: new Date().toISOString(),
    });

    return {
      id: transfer.id,
      callSessionId: transfer.callSessionId,
      userId: transfer.userId,
      sourceDeviceId: transfer.sourceDeviceId,
      targetDeviceId: transfer.targetDeviceId,
      status: DeviceTransferStatus.REQUESTED,
      initiatedAt: transfer.initiatedAt.toISOString(),
    };
  }

  /**
   * Completes a device handoff without interrupting the CallSession.
   */
  async completeDeviceTransfer(userId: string, transferId: string): Promise<void> {
    const transfer = await this.prisma.callDeviceTransfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer || transfer.userId !== userId) {
      throw new CallingException('Device transfer not found or unauthorized');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.callLeg.create({
        data: {
          callSessionId: transfer.callSessionId,
          userId,
          deviceId: transfer.targetDeviceId,
          direction: CallDirection.INBOUND as any,
          status: CallLegStatus.CONNECTED as any,
        },
      });

      await tx.callLeg.updateMany({
        where: {
          callSessionId: transfer.callSessionId,
          userId,
          deviceId: transfer.sourceDeviceId,
          status: 'CONNECTED',
        },
        data: {
          status: 'ENDED',
          endedAt: new Date(),
        },
      });

      await this.stateMachine.transitionDeviceTransfer(
        transferId,
        [
          DeviceTransferStatus.REQUESTED,
          DeviceTransferStatus.AUTHENTICATING,
          DeviceTransferStatus.CONNECTING,
          DeviceTransferStatus.CONNECTED,
        ],
        DeviceTransferStatus.COMPLETED,
        undefined,
        tx,
      );

      await tx.outboxEvent.create({
        data: {
          eventType: 'call.device_transfer.completed',
          aggregateType: 'CallSession',
          aggregateId: transfer.callSessionId,
          payloadJson: JSON.stringify({ transferId, userId, targetDeviceId: transfer.targetDeviceId }),
          status: 'PENDING',
          correlationId: transfer.callSessionId,
        },
      });
    });

    this.signalingGateway.broadcastToUser(userId, 'call.device_transfer.completed', {
      transferId,
      callId: transfer.callSessionId,
      targetDeviceId: transfer.targetDeviceId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Starts call recording with multi-party consent records and visual indicator emission.
   */
  async startRecording(
    userId: string,
    callId: string,
    recordingType = RecordingType.COMBINED,
  ): Promise<RecordingSessionSummary> {
    await this.authorizationService.assertCanStartRecording(userId, callId);

    const recording = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.recordingSession.create({
        data: {
          callSessionId: callId,
          initiatorUserId: userId,
          recordingType: recordingType as any,
          status: RecordingStatus.RECORDING as any,
          startedAt: new Date(),
          storagePath: `recordings/${callId}/${Date.now()}.mp4`,
          storageBucket: 'nexavoice-recordings',
        },
      });

      const participants = await tx.callParticipant.findMany({
        where: { callSessionId: callId, state: { in: ['CONNECTED', 'JOINED', 'ON_HOLD', 'MUTED'] } },
      });

      for (const p of participants) {
        await tx.recordingConsent.create({
          data: {
            recordingSessionId: rec.id,
            participantUserId: p.userId,
            policyVersion: '1.0',
            consentState: p.userId === userId ? ('GRANTED' as any) : ('PENDING' as any),
            consentedAt: p.userId === userId ? new Date() : undefined,
          },
        });
      }

      await tx.callEvent.create({
        data: {
          callSessionId: callId,
          actorId: userId,
          eventType: 'RECORDING_STARTED',
          payloadJson: JSON.stringify({ recordingId: rec.id, recordingType }),
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'call.recording.started',
          aggregateType: 'CallSession',
          aggregateId: callId,
          payloadJson: JSON.stringify({ callId, recordingId: rec.id, initiatedBy: userId }),
          status: 'PENDING',
          correlationId: callId,
        },
      });

      return rec;
    });

    this.signalingGateway.broadcastToCall(callId, 'call.recording.started', {
      callId,
      recordingId: recording.id,
      recordingType,
      startedBy: userId,
      indicator: {
        isActive: true,
        isPaused: false,
        label: 'Recording in progress',
      },
      timestamp: new Date().toISOString(),
    });

    return {
      id: recording.id,
      callSessionId: recording.callSessionId,
      initiatorUserId: recording.initiatorUserId,
      status: RecordingStatus.RECORDING,
      recordingType: recording.recordingType as RecordingType,
      durationSeconds: 0,
      isLegalHold: false,
      retentionDays: 30,
      startedAt: recording.startedAt?.toISOString(),
      consents: [],
    };
  }

  /**
   * Pauses recording.
   */
  async pauseRecording(userId: string, recordingId: string): Promise<void> {
    const recording = await this.authorizationService.assertCanAccessRecording(userId, recordingId);

    await this.stateMachine.transitionRecordingSession(
      recordingId,
      [RecordingStatus.RECORDING],
      RecordingStatus.PAUSED,
    );

    this.signalingGateway.broadcastToCall(recording.callSessionId, 'call.recording.paused', {
      recordingId,
      pausedBy: userId,
      indicator: {
        isActive: true,
        isPaused: true,
        label: 'Recording paused',
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Resumes recording.
   */
  async resumeRecording(userId: string, recordingId: string): Promise<void> {
    const recording = await this.authorizationService.assertCanAccessRecording(userId, recordingId);

    await this.stateMachine.transitionRecordingSession(
      recordingId,
      [RecordingStatus.PAUSED],
      RecordingStatus.RECORDING,
    );

    this.signalingGateway.broadcastToCall(recording.callSessionId, 'call.recording.resumed', {
      recordingId,
      resumedBy: userId,
      indicator: {
        isActive: true,
        isPaused: false,
        label: 'Recording in progress',
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Stops recording and finalizes duration.
   */
  async stopRecording(userId: string, recordingId: string): Promise<void> {
    const recording = await this.authorizationService.assertCanAccessRecording(userId, recordingId);

    await this.prisma.$transaction(async (tx) => {
      await this.stateMachine.transitionRecordingSession(
        recordingId,
        [RecordingStatus.RECORDING, RecordingStatus.PAUSED],
        RecordingStatus.COMPLETED,
        undefined,
        tx,
      );

      await tx.callEvent.create({
        data: {
          callSessionId: recording.callSessionId,
          actorId: userId,
          eventType: 'RECORDING_STOPPED',
          payloadJson: JSON.stringify({ recordingId }),
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'call.recording.stopped',
          aggregateType: 'CallSession',
          aggregateId: recording.callSessionId,
          payloadJson: JSON.stringify({ recordingId, stoppedBy: userId }),
          status: 'PENDING',
          correlationId: recording.callSessionId,
        },
      });
    });

    this.signalingGateway.broadcastToCall(recording.callSessionId, 'call.recording.stopped', {
      callId: recording.callSessionId,
      recordingId,
      stoppedBy: userId,
      indicator: {
        isActive: false,
        isPaused: false,
        label: 'Recording stopped',
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Submits or updates participant recording consent.
   */
  async submitRecordingConsent(userId: string, recordingSessionId: string, consented: boolean): Promise<void> {
    const consentState = consented ? ConsentState.GRANTED : ConsentState.DENIED;

    await this.prisma.recordingConsent.upsert({
      where: {
        recordingSessionId_participantUserId: {
          recordingSessionId,
          participantUserId: userId,
        },
      },
      create: {
        recordingSessionId,
        participantUserId: userId,
        consentState: consentState as any,
        consentedAt: consented ? new Date() : undefined,
      },
      update: {
        consentState: consentState as any,
        consentedAt: consented ? new Date() : undefined,
      },
    });

    const recording = await this.prisma.recordingSession.findUnique({
      where: { id: recordingSessionId },
    });

    if (recording) {
      this.signalingGateway.broadcastToCall(recording.callSessionId, 'call.recording.consent_updated', {
        recordingId: recordingSessionId,
        userId,
        consentState,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Generates time-limited signed URL for recording playback.
   */
  async getRecordingPlaybackUrl(userId: string, recordingId: string): Promise<string> {
    const recording = await this.authorizationService.assertCanAccessRecording(userId, recordingId);
    const token = Buffer.from(`${recordingId}:${userId}:${Date.now() + 3600}`).toString('base64url');
    return `https://storage.nexavoice.internal/recordings/${recording.id}.mp4?access_token=${token}`;
  }

  /**
   * Deletes a recording and its metadata.
   */
  async deleteRecording(userId: string, recordingId: string): Promise<void> {
    await this.authorizationService.assertCanAccessRecording(userId, recordingId);

    await this.stateMachine.transitionRecordingSession(
      recordingId,
      [RecordingStatus.COMPLETED, RecordingStatus.FAILED],
      RecordingStatus.DELETED,
    );
  }

  /**
   * Transcribes a call session or recording.
   */
  async transcribeCall(userId: string, callId: string, recordingId?: string): Promise<CallTranscriptSummary> {
    await this.authorizationService.assertCanAccessCall(userId, callId);

    const call = await this.prisma.callSession.findUnique({
      where: { id: callId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, displayName: true } },
          },
        },
      },
    });

    const participantMap: Record<string, string> = {};
    for (const p of call?.participants || []) {
      participantMap[p.userId] = p.user?.displayName || 'User';
    }

    const result = await this.transcriptionProvider.processAudio({
      callSessionId: callId,
      recordingId,
      participantMap,
    });

    const transcript = await this.prisma.$transaction(async (tx) => {
      const tr = await tx.callTranscript.create({
        data: {
          callSessionId: callId,
          recordingSessionId: recordingId,
          provider: this.transcriptionProvider.providerName,
          status: TranscriptStatus.COMPLETED as any,
          fullText: result.fullText,
        },
      });

      for (const seg of result.segments) {
        await tx.transcriptSegment.create({
          data: {
            transcriptId: tr.id,
            speakerUserId: seg.speakerUserId,
            speakerLabel: seg.speakerLabel,
            startMs: seg.startMs,
            endMs: seg.endMs,
            text: seg.text,
            confidence: seg.confidence,
          },
        });
      }

      return tr;
    });

    return {
      id: transcript.id,
      callSessionId: transcript.callSessionId,
      recordingSessionId: transcript.recordingSessionId || undefined,
      provider: transcript.provider,
      language: transcript.language,
      status: TranscriptStatus.COMPLETED,
      fullText: transcript.fullText || undefined,
      segments: result.segments.map((s, idx) => ({ id: `seg-${idx}`, ...s })),
    };
  }

  /**
   * Schedules a call session.
   */
  async scheduleCall(
    organizerId: string,
    input: {
      title: string;
      description?: string;
      scheduledStartTime: Date;
      scheduledEndTime?: Date;
      timezone: string;
      inviteeUserIds: string[];
      reminderMinutes?: number;
      roomId?: string;
    },
  ): Promise<ScheduledCallSummary> {
    const scheduled = await this.prisma.$transaction(async (tx) => {
      const sc = await tx.scheduledCall.create({
        data: {
          organizerId,
          title: input.title,
          description: input.description,
          scheduledStartTime: input.scheduledStartTime,
          scheduledEndTime: input.scheduledEndTime,
          timezone: input.timezone || 'UTC',
          reminderMinutes: input.reminderMinutes || 15,
          roomId: input.roomId,
          status: ScheduledCallStatus.SCHEDULED as any,
        },
      });

      for (const inviteeId of input.inviteeUserIds) {
        if (inviteeId === organizerId) continue;
        await tx.scheduledCallInvitee.create({
          data: {
            scheduledCallId: sc.id,
            userId: inviteeId,
            status: InvitationStatus.PENDING as any,
          },
        });
      }

      await tx.outboxEvent.create({
        data: {
          eventType: 'call.scheduled',
          aggregateType: 'ScheduledCall',
          aggregateId: sc.id,
          payloadJson: JSON.stringify({ scheduledCallId: sc.id, organizerId, inviteeUserIds: input.inviteeUserIds }),
          status: 'PENDING',
          correlationId: sc.id,
        },
      });

      return sc;
    });

    for (const inviteeId of input.inviteeUserIds) {
      if (inviteeId === organizerId) continue;
      this.signalingGateway.broadcastToUser(inviteeId, 'call.scheduled', {
        scheduledCallId: scheduled.id,
        title: input.title,
        startTime: input.scheduledStartTime.toISOString(),
        timezone: input.timezone,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      id: scheduled.id,
      organizerId: scheduled.organizerId,
      roomId: scheduled.roomId || undefined,
      title: scheduled.title,
      description: scheduled.description || undefined,
      scheduledStartTime: scheduled.scheduledStartTime.toISOString(),
      scheduledEndTime: scheduled.scheduledEndTime?.toISOString(),
      timezone: scheduled.timezone,
      status: ScheduledCallStatus.SCHEDULED,
      reminderMinutes: scheduled.reminderMinutes,
      inviteeCount: input.inviteeUserIds.length,
      createdAt: scheduled.createdAt.toISOString(),
      updatedAt: (scheduled as any).updatedAt ? (scheduled as any).updatedAt.toISOString() : scheduled.createdAt.toISOString(),
    };
  }

  /**
   * Cancels a scheduled call.
   */
  async cancelScheduledCall(userId: string, scheduledCallId: string): Promise<void> {
    const scheduled = await this.prisma.scheduledCall.findUnique({
      where: { id: scheduledCallId },
      include: { invitees: true },
    });

    if (!scheduled || scheduled.organizerId !== userId) {
      throw new CallingException('Scheduled call not found or you are not the organizer');
    }

    await this.stateMachine.transitionScheduledCall(
      scheduledCallId,
      [ScheduledCallStatus.SCHEDULED, ScheduledCallStatus.STARTING],
      ScheduledCallStatus.CANCELLED,
    );

    for (const inv of scheduled.invitees) {
      this.signalingGateway.broadcastToUser(inv.userId, 'call.scheduled.cancelled', {
        scheduledCallId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Retrieves single CallSession by ID with zero-trust IDOR verification.
   */
  async getCall(userId: string, callId: string): Promise<CallSessionSummary> {
    await this.authorizationService.assertCanAccessCall(userId, callId);

    const call = await this.prisma.callSession.findUnique({
      where: { id: callId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        legs: true,
        mediaSessions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!call) {
      throw new CallNotFoundException(callId);
    }

    return this.mapCallSummary(call);
  }

  /**
   * Retrieves active calls for the current user.
   */
  async getActiveCalls(userId: string): Promise<CallSessionSummary[]> {
    const calls = await this.prisma.callSession.findMany({
      where: {
        status: { in: ['NEW', 'RINGING', 'CONNECTING', 'ACTIVE', 'HELD'] },
        participants: {
          some: {
            userId,
            state: { in: ['INVITED', 'RINGING', 'JOINED', 'CONNECTED', 'MUTED', 'ON_HOLD'] },
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        legs: true,
        mediaSessions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    return calls.map((c) => this.mapCallSummary(c));
  }

  /**
   * Retrieves paginated call history for user.
   */
  async getCallHistory(userId: string, limit = 20, offset = 0): Promise<CallSessionSummary[]> {
    const calls = await this.prisma.callSession.findMany({
      where: {
        status: { in: ['ENDED', 'FAILED', 'MISSED', 'REJECTED'] },
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        legs: true,
        mediaSessions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return calls.map((c) => this.mapCallSummary(c));
  }

  /**
   * Securely returns ICE server configurations for an authorized call.
   */
  async getIceServers(userId: string, callId: string): Promise<IceServerConfig[]> {
    await this.authorizationService.assertCanAccessCall(userId, callId);
    return this.localPeerProvider.getIceServers(userId);
  }

  /**
   * Retrieves recordings for an authorized call session.
   */
  async getRecordingsForCall(userId: string, callId: string): Promise<RecordingSessionSummary[]> {
    await this.authorizationService.assertCanAccessCall(userId, callId);
    const recordings = await this.prisma.recordingSession.findMany({
      where: { callSessionId: callId, status: { not: 'DELETED' as any } },
      include: { consents: true },
      orderBy: { createdAt: 'desc' },
    });

    return recordings.map((r) => ({
      id: r.id,
      callSessionId: r.callSessionId,
      initiatorUserId: r.initiatorUserId,
      status: r.status as RecordingStatus,
      recordingType: r.recordingType as RecordingType,
      durationSeconds: r.durationSeconds,
      isLegalHold: r.isLegalHold,
      retentionDays: r.retentionDays,
      startedAt: r.startedAt?.toISOString(),
      pausedAt: r.pausedAt?.toISOString(),
      stoppedAt: r.stoppedAt?.toISOString(),
      createdAt: r.createdAt.toISOString(),
      consents: r.consents.map((c) => ({
        id: c.id,
        recordingSessionId: c.recordingSessionId,
        participantUserId: c.participantUserId,
        policyVersion: c.policyVersion || '1.0',
        consentState: c.consentState as ConsentState,
        consentedAt: c.consentedAt?.toISOString(),
      })),
    }));
  }

  /**
   * Retrieves scheduled calls for the current user.
   */
  async getScheduledCalls(userId: string): Promise<ScheduledCallSummary[]> {
    const scheduled = await this.prisma.scheduledCall.findMany({
      where: {
        OR: [
          { organizerId: userId },
          { invitees: { some: { userId } } },
        ],
      },
      include: { invitees: true },
      orderBy: { scheduledStartTime: 'asc' },
    });

    return scheduled.map((s) => ({
      id: s.id,
      organizerId: s.organizerId,
      roomId: s.roomId || undefined,
      callSessionId: s.callSessionId || undefined,
      title: s.title,
      description: s.description || undefined,
      scheduledStartTime: s.scheduledStartTime.toISOString(),
      scheduledEndTime: s.scheduledEndTime?.toISOString(),
      timezone: s.timezone,
      status: s.status as ScheduledCallStatus,
      reminderMinutes: s.reminderMinutes,
      inviteeCount: s.invitees.length,
      createdAt: s.createdAt.toISOString(),
      updatedAt: (s as any).updatedAt ? (s as any).updatedAt.toISOString() : s.createdAt.toISOString(),
      invitees: s.invitees.map((inv) => ({
        id: inv.id,
        scheduledCallId: inv.scheduledCallId,
        userId: inv.userId,
        status: inv.status,
      })),
    }));
  }

  /**
   * Retrieves transcripts for a recording session.
   */
  async getTranscripts(userId: string, recordingId: string): Promise<CallTranscriptSummary[]> {
    await this.authorizationService.assertCanAccessRecording(userId, recordingId);
    const transcripts = await this.prisma.callTranscript.findMany({
      where: { recordingSessionId: recordingId },
      include: { segments: { orderBy: { startMs: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return transcripts.map((t) => ({
      id: t.id,
      callSessionId: t.callSessionId,
      recordingSessionId: t.recordingSessionId || undefined,
      provider: t.provider,
      language: t.language,
      status: t.status as TranscriptStatus,
      fullText: t.fullText || undefined,
      createdAt: t.createdAt.toISOString(),
      segments: t.segments.map((seg) => ({
        id: seg.id,
        speakerUserId: seg.speakerUserId || undefined,
        speakerLabel: seg.speakerLabel,
        startMs: seg.startMs,
        endMs: seg.endMs,
        text: seg.text,
        confidence: seg.confidence,
      })),
    }));
  }

  private mapCallSummary(call: any): CallSessionSummary {
    const participants: CallParticipantSummary[] = (call.participants || []).map((p: any) => ({
      participantId: p.id,
      userId: p.userId,
      displayName: p.user?.displayName || 'User',
      avatarUrl: p.user?.avatarUrl || undefined,
      role: p.role as ParticipantRole,
      state: p.state as ParticipantState,
      isAudioMuted: p.isAudioMuted,
      isVideoMuted: p.isVideoMuted,
      isScreenSharing: p.isScreenSharing,
      isOnHold: p.isOnHold,
      permissions: {
        canMuteOthers: p.canMuteOthers,
        canRemoveParticipants: p.canRemoveParticipants,
        canInviteParticipants: p.canInviteParticipants,
        canShareScreen: p.canShareScreen,
        canRecord: p.canRecord,
        canEndCall: p.canEndCall,
      },
      joinedAt: p.joinedAt ? p.joinedAt.toISOString() : p.createdAt.toISOString(),
      leftAt: p.leftAt ? p.leftAt.toISOString() : undefined,
    }));

    const legs: CallLegSummary[] = (call.legs || []).map((l: any) => ({
      id: l.id,
      callSessionId: l.callSessionId,
      userId: l.userId,
      deviceId: l.deviceId || undefined,
      direction: l.direction as CallDirection,
      status: l.status as CallLegStatus,
      startedAt: l.startedAt.toISOString(),
      connectedAt: l.connectedAt ? l.connectedAt.toISOString() : undefined,
      endedAt: l.endedAt ? l.endedAt.toISOString() : undefined,
    }));

    let mediaSession: MediaSessionSummary | undefined;
    if (call.mediaSessions && call.mediaSessions.length > 0) {
      const ms = call.mediaSessions[0];
      let iceServers: IceServerConfig[] = [];
      try {
        iceServers = JSON.parse(ms.iceServersJson || '[]');
      } catch {
        iceServers = [];
      }
      mediaSession = {
        id: ms.id,
        callSessionId: ms.callSessionId,
        provider: ms.provider,
        mode: ms.mode as MediaMode,
        status: ms.status as MediaSessionStatus,
        sfuRoomId: ms.sfuRoomId || undefined,
        iceServers,
      };
    }

    return {
      id: call.id,
      conversationId: call.conversationId || undefined,
      callType: call.callType as CallType,
      status: call.status as CallSessionStatus,
      hostUserId: call.hostUserId,
      roomName: call.roomName || undefined,
      isPersistent: call.isPersistent,
      maxParticipants: call.maxParticipants,
      startedAt: call.startedAt.toISOString(),
      activeAt: call.activeAt ? call.activeAt.toISOString() : undefined,
      endedAt: call.endedAt ? call.endedAt.toISOString() : undefined,
      endReason: call.endReason || undefined,
      participants,
      legs,
      mediaSession,
    };
  }
}
