import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CallSessionStatus,
  CallLegStatus,
  ParticipantState,
  MediaSessionStatus,
  InvitationStatus,
  WaitingRoomState,
  ScheduledCallStatus,
  DeviceTransferStatus,
  RecordingStatus,
  canTransitionCallSession,
  canTransitionCallLeg,
  canTransitionParticipant,
  canTransitionMediaSession,
  canTransitionInvitation,
  canTransitionWaitingRoom,
  canTransitionScheduledCall,
  canTransitionDeviceTransfer,
  canTransitionRecordingSession,
} from '@nexavoice/domain-types';
import {
  InvalidCallStateTransitionException,
  CallNotFoundException,
} from '../exceptions/calling.exceptions';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

@Injectable()
export class CallStateMachineService {
  private readonly logger = new StructuredLogger('CallStateMachineService');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Transitions a CallSession deterministically.
   * Validates:
   * 1. Call exists
   * 2. Current state matches expectedState (single or array of allowed current states)
   * 3. Next state is a valid transition from current state according to the formal state machine
   */
  async transitionCallSession(
    callId: string,
    expectedState: CallSessionStatus | CallSessionStatus[],
    nextState: CallSessionStatus,
    prismaTx?: Prisma.TransactionClient,
    endReason?: string,
  ) {
    const client = prismaTx || this.prisma;
    const session = await client.callSession.findUnique({
      where: { id: callId },
    });

    if (!session) {
      throw new CallNotFoundException(callId);
    }

    const currentStatus = session.status as unknown as CallSessionStatus;

    // Idempotent no-op if already in nextState
    if (currentStatus === nextState) {
      return session;
    }

    const expectedArray = Array.isArray(expectedState) ? expectedState : [expectedState];
    if (!expectedArray.includes(currentStatus)) {
      throw new InvalidCallStateTransitionException(
        'CallSession',
        callId,
        currentStatus,
        nextState,
        `Current state '${currentStatus}' does not match expected state(s): ${expectedArray.join(', ')}`,
      );
    }

    if (!canTransitionCallSession(currentStatus, nextState)) {
      throw new InvalidCallStateTransitionException(
        'CallSession',
        callId,
        currentStatus,
        nextState,
        `Transition from '${currentStatus}' to '${nextState}' is not permitted by state machine`,
      );
    }

    const now = new Date();
    const updateData: Prisma.CallSessionUpdateInput = {
      status: nextState as any,
    };

    if (nextState === CallSessionStatus.ACTIVE && !session.activeAt) {
      updateData.activeAt = now;
    }

    if (
      nextState === CallSessionStatus.ENDED ||
      nextState === CallSessionStatus.FAILED ||
      nextState === CallSessionStatus.MISSED ||
      nextState === CallSessionStatus.REJECTED
    ) {
      updateData.endedAt = now;
      if (endReason) {
        updateData.endReason = endReason;
      }
    }

    const updated = await client.callSession.update({
      where: { id: callId },
      data: updateData,
    });

    this.logger.log({
      event: 'call_session_state_transition',
      callId,
      fromState: currentStatus,
      toState: nextState,
      endReason,
    });

    return updated;
  }

  /**
   * Transitions a CallLeg deterministically.
   */
  async transitionCallLeg(
    legId: string,
    expectedState: CallLegStatus | CallLegStatus[],
    nextState: CallLegStatus,
    prismaTx?: Prisma.TransactionClient,
    endReason?: string,
  ) {
    const client = prismaTx || this.prisma;
    const leg = await client.callLeg.findUnique({
      where: { id: legId },
    });

    if (!leg) {
      throw new InvalidCallStateTransitionException('CallLeg', legId, 'UNKNOWN', nextState, 'Leg not found');
    }

    const currentStatus = leg.status as unknown as CallLegStatus;

    if (currentStatus === nextState) {
      return leg;
    }

    const expectedArray = Array.isArray(expectedState) ? expectedState : [expectedState];
    if (!expectedArray.includes(currentStatus)) {
      throw new InvalidCallStateTransitionException(
        'CallLeg',
        legId,
        currentStatus,
        nextState,
        `Current state '${currentStatus}' does not match expected state(s): ${expectedArray.join(', ')}`,
      );
    }

    if (!canTransitionCallLeg(currentStatus, nextState)) {
      throw new InvalidCallStateTransitionException(
        'CallLeg',
        legId,
        currentStatus,
        nextState,
        `Transition from '${currentStatus}' to '${nextState}' is not permitted by state machine`,
      );
    }

    const now = new Date();
    const updateData: Prisma.CallLegUpdateInput = {
      status: nextState as any,
    };

    if (nextState === CallLegStatus.CONNECTED && !leg.connectedAt) {
      updateData.connectedAt = now;
    }

    if (nextState === CallLegStatus.ENDED || nextState === CallLegStatus.FAILED) {
      updateData.endedAt = now;
      if (endReason) {
        updateData.endReason = endReason;
      }
    }

    const updated = await client.callLeg.update({
      where: { id: legId },
      data: updateData,
    });

    this.logger.log({
      event: 'call_leg_state_transition',
      legId,
      callSessionId: leg.callSessionId,
      fromState: currentStatus,
      toState: nextState,
    });

    return updated;
  }

  /**
   * Transitions a CallParticipant deterministically.
   */
  async transitionParticipant(
    participantId: string,
    expectedState: ParticipantState | ParticipantState[],
    nextState: ParticipantState,
    prismaTx?: Prisma.TransactionClient,
  ) {
    const client = prismaTx || this.prisma;
    const participant = await client.callParticipant.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      throw new InvalidCallStateTransitionException(
        'CallParticipant',
        participantId,
        'UNKNOWN',
        nextState,
        'Participant not found',
      );
    }

    const currentState = participant.state as unknown as ParticipantState;

    if (currentState === nextState) {
      return participant;
    }

    const expectedArray = Array.isArray(expectedState) ? expectedState : [expectedState];
    if (!expectedArray.includes(currentState)) {
      throw new InvalidCallStateTransitionException(
        'CallParticipant',
        participantId,
        currentState,
        nextState,
        `Current state '${currentState}' does not match expected state(s): ${expectedArray.join(', ')}`,
      );
    }

    if (!canTransitionParticipant(currentState, nextState)) {
      throw new InvalidCallStateTransitionException(
        'CallParticipant',
        participantId,
        currentState,
        nextState,
        `Transition from '${currentState}' to '${nextState}' is not permitted by state machine`,
      );
    }

    const now = new Date();
    const updateData: Prisma.CallParticipantUpdateInput = {
      state: nextState as any,
    };

    if (
      nextState === ParticipantState.LEFT ||
      nextState === ParticipantState.REMOVED ||
      nextState === ParticipantState.DECLINED ||
      nextState === ParticipantState.MISSED
    ) {
      updateData.leftAt = now;
    }

    const updated = await client.callParticipant.update({
      where: { id: participantId },
      data: updateData,
    });

    this.logger.log({
      event: 'call_participant_state_transition',
      participantId,
      callSessionId: participant.callSessionId,
      userId: participant.userId,
      fromState: currentState,
      toState: nextState,
    });

    return updated;
  }

  /**
   * Transitions a MediaSession deterministically.
   */
  async transitionMediaSession(
    mediaSessionId: string,
    expectedState: MediaSessionStatus | MediaSessionStatus[],
    nextState: MediaSessionStatus,
    prismaTx?: Prisma.TransactionClient,
  ) {
    const client = prismaTx || this.prisma;
    const mediaSession = await client.mediaSession.findUnique({
      where: { id: mediaSessionId },
    });

    if (!mediaSession) {
      throw new InvalidCallStateTransitionException(
        'MediaSession',
        mediaSessionId,
        'UNKNOWN',
        nextState,
        'MediaSession not found',
      );
    }

    const currentStatus = mediaSession.status as unknown as MediaSessionStatus;

    if (currentStatus === nextState) {
      return mediaSession;
    }

    const expectedArray = Array.isArray(expectedState) ? expectedState : [expectedState];
    if (!expectedArray.includes(currentStatus)) {
      throw new InvalidCallStateTransitionException(
        'MediaSession',
        mediaSessionId,
        currentStatus,
        nextState,
        `Current status '${currentStatus}' does not match expected status(es): ${expectedArray.join(', ')}`,
      );
    }

    if (!canTransitionMediaSession(currentStatus, nextState)) {
      throw new InvalidCallStateTransitionException(
        'MediaSession',
        mediaSessionId,
        currentStatus,
        nextState,
        `Transition from '${currentStatus}' to '${nextState}' is not permitted by state machine`,
      );
    }

    const updateData: Prisma.MediaSessionUpdateInput = {
      status: nextState as any,
    };

    if (nextState === MediaSessionStatus.CLOSED) {
      updateData.closedAt = new Date();
    }

    const updated = await client.mediaSession.update({
      where: { id: mediaSessionId },
      data: updateData,
    });

    this.logger.log({
      event: 'media_session_state_transition',
      mediaSessionId,
      callSessionId: mediaSession.callSessionId,
      fromStatus: currentStatus,
      toStatus: nextState,
    });

    return updated;
  }

  /**
   * Transitions a CallInvitation deterministically.
   */
  async transitionInvitation(
    invitationId: string,
    expectedState: InvitationStatus | InvitationStatus[],
    nextState: InvitationStatus,
    prismaTx?: Prisma.TransactionClient,
  ) {
    const client = prismaTx || this.prisma;
    const invitation = await client.callInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new InvalidCallStateTransitionException(
        'CallInvitation',
        invitationId,
        'UNKNOWN',
        nextState,
        'Invitation not found',
      );
    }

    const currentStatus = invitation.status as unknown as InvitationStatus;

    if (currentStatus === nextState) {
      return invitation;
    }

    const expectedArray = Array.isArray(expectedState) ? expectedState : [expectedState];
    if (!expectedArray.includes(currentStatus)) {
      throw new InvalidCallStateTransitionException(
        'CallInvitation',
        invitationId,
        currentStatus,
        nextState,
        `Current status '${currentStatus}' does not match expected status(es): ${expectedArray.join(', ')}`,
      );
    }

    if (!canTransitionInvitation(currentStatus, nextState)) {
      throw new InvalidCallStateTransitionException(
        'CallInvitation',
        invitationId,
        currentStatus,
        nextState,
        `Transition from '${currentStatus}' to '${nextState}' is not permitted by state machine`,
      );
    }

    const updateData: Prisma.CallInvitationUpdateInput = {
      status: nextState as any,
      respondedAt: new Date(),
    };

    const updated = await client.callInvitation.update({
      where: { id: invitationId },
      data: updateData,
    });

    this.logger.log({
      event: 'call_invitation_state_transition',
      invitationId,
      callSessionId: invitation.callSessionId,
      inviteeId: invitation.inviteeId,
      fromStatus: currentStatus,
      toStatus: nextState,
    });

    return updated;
  }

  /**
   * Transitions a participant's WaitingRoomState deterministically.
   */
  async transitionWaitingRoom(
    callId: string,
    userId: string,
    expectedState: WaitingRoomState | WaitingRoomState[],
    nextState: WaitingRoomState,
    admittedByUserId?: string,
    prismaTx?: Prisma.TransactionClient,
  ) {
    const client = prismaTx || this.prisma;
    const participant = await client.callParticipant.findUnique({
      where: {
        callSessionId_userId: {
          callSessionId: callId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new InvalidCallStateTransitionException(
        'CallParticipantWaitingRoom',
        `${callId}:${userId}`,
        'UNKNOWN',
        nextState,
        'Participant not found',
      );
    }

    const currentStatus = participant.waitingState as unknown as WaitingRoomState;

    if (currentStatus === nextState) {
      return participant;
    }

    const expectedArray = Array.isArray(expectedState) ? expectedState : [expectedState];
    if (!expectedArray.includes(currentStatus)) {
      throw new InvalidCallStateTransitionException(
        'CallParticipantWaitingRoom',
        `${callId}:${userId}`,
        currentStatus,
        nextState,
        `Current waitingState '${currentStatus}' does not match expected state(s): ${expectedArray.join(', ')}`,
      );
    }

    if (!canTransitionWaitingRoom(currentStatus, nextState)) {
      throw new InvalidCallStateTransitionException(
        'CallParticipantWaitingRoom',
        `${callId}:${userId}`,
        currentStatus,
        nextState,
        `Transition from '${currentStatus}' to '${nextState}' is not permitted by waiting room state machine`,
      );
    }

    const updateData: Prisma.CallParticipantUpdateInput = {
      waitingState: nextState as any,
    };

    if (nextState === WaitingRoomState.ADMITTED) {
      updateData.admittedAt = new Date();
      if (admittedByUserId) {
        updateData.admittedByUserId = admittedByUserId;
      }
    }

    const updated = await client.callParticipant.update({
      where: {
        callSessionId_userId: {
          callSessionId: callId,
          userId,
        },
      },
      data: updateData,
    });

    this.logger.log({
      event: 'waiting_room_state_transition',
      callId,
      userId,
      fromState: currentStatus,
      toState: nextState,
      admittedByUserId,
    });

    return updated;
  }

  /**
   * Transitions a CallDeviceTransfer deterministically.
   */
  async transitionDeviceTransfer(
    transferId: string,
    expectedState: DeviceTransferStatus | DeviceTransferStatus[],
    nextState: DeviceTransferStatus,
    failureReason?: string,
    prismaTx?: Prisma.TransactionClient,
  ) {
    const client = prismaTx || this.prisma;
    const transfer = await client.callDeviceTransfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer) {
      throw new InvalidCallStateTransitionException(
        'CallDeviceTransfer',
        transferId,
        'UNKNOWN',
        nextState,
        'Device transfer not found',
      );
    }

    const currentStatus = transfer.status as unknown as DeviceTransferStatus;

    if (currentStatus === nextState) {
      return transfer;
    }

    const expectedArray = Array.isArray(expectedState) ? expectedState : [expectedState];
    if (!expectedArray.includes(currentStatus)) {
      throw new InvalidCallStateTransitionException(
        'CallDeviceTransfer',
        transferId,
        currentStatus,
        nextState,
        `Current status '${currentStatus}' does not match expected status(es): ${expectedArray.join(', ')}`,
      );
    }

    if (!canTransitionDeviceTransfer(currentStatus, nextState)) {
      throw new InvalidCallStateTransitionException(
        'CallDeviceTransfer',
        transferId,
        currentStatus,
        nextState,
        `Transition from '${currentStatus}' to '${nextState}' is not permitted by state machine`,
      );
    }

    const updateData: Prisma.CallDeviceTransferUpdateInput = {
      status: nextState as any,
    };

    if (nextState === DeviceTransferStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }
    if (failureReason) {
      updateData.failureReason = failureReason;
    }

    const updated = await client.callDeviceTransfer.update({
      where: { id: transferId },
      data: updateData,
    });

    this.logger.log({
      event: 'call_device_transfer_state_transition',
      transferId,
      callSessionId: transfer.callSessionId,
      userId: transfer.userId,
      fromStatus: currentStatus,
      toStatus: nextState,
      failureReason,
    });

    return updated;
  }

  /**
   * Transitions a RecordingSession deterministically.
   */
  async transitionRecordingSession(
    recordingId: string,
    expectedState: RecordingStatus | RecordingStatus[],
    nextState: RecordingStatus,
    failureReason?: string,
    prismaTx?: Prisma.TransactionClient,
  ) {
    const client = prismaTx || this.prisma;
    const recording = await client.recordingSession.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      throw new InvalidCallStateTransitionException(
        'RecordingSession',
        recordingId,
        'UNKNOWN',
        nextState,
        'Recording session not found',
      );
    }

    const currentStatus = recording.status as unknown as RecordingStatus;

    if (currentStatus === nextState) {
      return recording;
    }

    const expectedArray = Array.isArray(expectedState) ? expectedState : [expectedState];
    if (!expectedArray.includes(currentStatus)) {
      throw new InvalidCallStateTransitionException(
        'RecordingSession',
        recordingId,
        currentStatus,
        nextState,
        `Current status '${currentStatus}' does not match expected status(es): ${expectedArray.join(', ')}`,
      );
    }

    if (!canTransitionRecordingSession(currentStatus, nextState)) {
      throw new InvalidCallStateTransitionException(
        'RecordingSession',
        recordingId,
        currentStatus,
        nextState,
        `Transition from '${currentStatus}' to '${nextState}' is not permitted by recording state machine`,
      );
    }

    const now = new Date();
    const updateData: Prisma.RecordingSessionUpdateInput = {
      status: nextState as any,
    };

    if (nextState === RecordingStatus.RECORDING && !recording.startedAt) {
      updateData.startedAt = now;
    } else if (nextState === RecordingStatus.PAUSED) {
      updateData.pausedAt = now;
    } else if (nextState === RecordingStatus.COMPLETED) {
      updateData.stoppedAt = now;
      if (recording.startedAt) {
        const diffSeconds = Math.max(0, Math.floor((now.getTime() - recording.startedAt.getTime()) / 1000));
        updateData.durationSeconds = diffSeconds;
      }
    } else if (nextState === RecordingStatus.DELETED) {
      updateData.deletedAt = now;
    }

    if (failureReason) {
      updateData.failureReason = failureReason;
    }

    const updated = await client.recordingSession.update({
      where: { id: recordingId },
      data: updateData,
    });

    this.logger.log({
      event: 'recording_session_state_transition',
      recordingId,
      callSessionId: recording.callSessionId,
      fromStatus: currentStatus,
      toStatus: nextState,
      failureReason,
    });

    return updated;
  }

  /**
   * Transitions a ScheduledCall deterministically.
   */
  async transitionScheduledCall(
    scheduledCallId: string,
    expectedState: ScheduledCallStatus | ScheduledCallStatus[],
    nextState: ScheduledCallStatus,
    prismaTx?: Prisma.TransactionClient,
  ) {
    const client = prismaTx || this.prisma;
    const scheduledCall = await client.scheduledCall.findUnique({
      where: { id: scheduledCallId },
    });

    if (!scheduledCall) {
      throw new InvalidCallStateTransitionException(
        'ScheduledCall',
        scheduledCallId,
        'UNKNOWN',
        nextState,
        'Scheduled call not found',
      );
    }

    const currentStatus = scheduledCall.status as unknown as ScheduledCallStatus;

    if (currentStatus === nextState) {
      return scheduledCall;
    }

    const expectedArray = Array.isArray(expectedState) ? expectedState : [expectedState];
    if (!expectedArray.includes(currentStatus)) {
      throw new InvalidCallStateTransitionException(
        'ScheduledCall',
        scheduledCallId,
        currentStatus,
        nextState,
        `Current status '${currentStatus}' does not match expected status(es): ${expectedArray.join(', ')}`,
      );
    }

    if (!canTransitionScheduledCall(currentStatus, nextState)) {
      throw new InvalidCallStateTransitionException(
        'ScheduledCall',
        scheduledCallId,
        currentStatus,
        nextState,
        `Transition from '${currentStatus}' to '${nextState}' is not permitted by scheduled call state machine`,
      );
    }

    const updated = await client.scheduledCall.update({
      where: { id: scheduledCallId },
      data: { status: nextState as any },
    });

    this.logger.log({
      event: 'scheduled_call_state_transition',
      scheduledCallId,
      fromStatus: currentStatus,
      toStatus: nextState,
    });

    return updated;
  }
}

