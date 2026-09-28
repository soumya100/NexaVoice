import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthorizationSubject, PermissionAction } from '@nexavoice/domain-types';
import { CurrentUser, RequirePermissions } from '../../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { CallingService } from '../services/calling.service';
import {
  CallSessionGql,
  IceServerConfigGql,
  InitiateCallInput,
  MuteParticipantInput,
  RemoveCallParticipantInput,
  ScheduledCallGql,
  CallDeviceTransferGql,
  RecordingSessionGql,
  CallTranscriptGql,
  RecordingPlaybackUrlGql,
  SwapCallsInput,
  BlindTransferInput,
  InitiateAttendedTransferInput,
  CompleteAttendedTransferInput,
  CancelAttendedTransferInput,
  MergeCallsInput,
  SplitConferenceCallInput,
  AdmitParticipantInput,
  DenyParticipantInput,
  LockConferenceInput,
  ScreenShareInput,
  InitiateDeviceTransferInput,
  CompleteDeviceTransferInput,
  StartRecordingInput,
  PauseRecordingInput,
  ResumeRecordingInput,
  StopRecordingInput,
  SubmitRecordingConsentInput,
  ScheduleCallInput,
} from './calling.types';

@Resolver()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CallingResolver {
  constructor(private readonly callingService: CallingService) {}

  @Query(() => CallSessionGql, { description: 'Get details for a specific call session' })
  @RequirePermissions(PermissionAction.CALL_JOIN)
  async call(
    @CurrentUser() user: AuthorizationSubject,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CallSessionGql> {
    const summary = await this.callingService.getCall(user.id, id);
    return summary as unknown as CallSessionGql;
  }

  @Query(() => [CallSessionGql], { description: 'Get all active calls for current user' })
  async activeCalls(@CurrentUser() user: AuthorizationSubject): Promise<CallSessionGql[]> {
    const summaries = await this.callingService.getActiveCalls(user.id);
    return summaries as unknown as CallSessionGql[];
  }

  @Query(() => [CallSessionGql], { description: 'Get call history for current user' })
  async callHistory(
    @CurrentUser() user: AuthorizationSubject,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit = 20,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 }) offset = 0,
  ): Promise<CallSessionGql[]> {
    const summaries = await this.callingService.getCallHistory(user.id, limit, offset);
    return summaries as unknown as CallSessionGql[];
  }

  @Query(() => [IceServerConfigGql], { description: 'Get ephemeral ICE/TURN server configs for call' })
  async callIceServers(
    @CurrentUser() user: AuthorizationSubject,
    @Args('callId', { type: () => ID }) callId: string,
  ): Promise<IceServerConfigGql[]> {
    const configs = await this.callingService.getIceServers(user.id, callId);
    return configs.map((c) => ({
      urls: Array.isArray(c.urls) ? c.urls : [c.urls],
      username: c.username,
      credential: c.credential,
    }));
  }

  @Query(() => [RecordingSessionGql], { description: 'Get recordings for a call session' })
  @RequirePermissions(PermissionAction.RECORDING_ACCESS)
  async callRecordings(
    @CurrentUser() user: AuthorizationSubject,
    @Args('callId', { type: () => ID }) callId: string,
  ): Promise<RecordingSessionGql[]> {
    const recordings = await this.callingService.getRecordingsForCall(user.id, callId);
    return recordings as unknown as RecordingSessionGql[];
  }

  @Query(() => RecordingPlaybackUrlGql, { description: 'Get time-limited signed URL for recording playback' })
  @RequirePermissions(PermissionAction.RECORDING_ACCESS)
  async recordingPlaybackUrl(
    @CurrentUser() user: AuthorizationSubject,
    @Args('recordingId', { type: () => ID }) recordingId: string,
  ): Promise<RecordingPlaybackUrlGql> {
    const playbackUrl = await this.callingService.getRecordingPlaybackUrl(user.id, recordingId);
    return {
      recordingId,
      playbackUrl,
      expiresInSeconds: 3600,
    };
  }

  @Query(() => [ScheduledCallGql], { description: 'Get scheduled calls for current user' })
  async scheduledCalls(@CurrentUser() user: AuthorizationSubject): Promise<ScheduledCallGql[]> {
    const scheduled = await this.callingService.getScheduledCalls(user.id);
    return scheduled as unknown as ScheduledCallGql[];
  }

  @Query(() => [CallTranscriptGql], { description: 'Get transcripts for a recording session' })
  @RequirePermissions(PermissionAction.TRANSCRIPTION_VIEW)
  async callTranscripts(
    @CurrentUser() user: AuthorizationSubject,
    @Args('recordingId', { type: () => ID }) recordingId: string,
  ): Promise<CallTranscriptGql[]> {
    const transcripts = await this.callingService.getTranscripts(user.id, recordingId);
    return transcripts as unknown as CallTranscriptGql[];
  }

  @Mutation(() => CallSessionGql, { description: 'Initiate a new call session' })
  @RequirePermissions(PermissionAction.CALL_CREATE)
  async initiateCall(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: InitiateCallInput,
  ): Promise<CallSessionGql> {
    const summary = await this.callingService.initiateCall(user.id, {
      callType: input.callType,
      inviteeUserIds: input.inviteeUserIds,
      conversationId: input.conversationId,
      roomName: input.roomName,
      maxParticipants: input.maxParticipants,
      scheduledStartTime: input.scheduledStartTime ? new Date(input.scheduledStartTime) : undefined,
      timezone: input.timezone,
    });
    return summary as unknown as CallSessionGql;
  }

  @Mutation(() => CallSessionGql, { description: 'Accept an incoming call' })
  @RequirePermissions(PermissionAction.CALL_ANSWER)
  async acceptCall(
    @CurrentUser() user: AuthorizationSubject,
    @Args('callId', { type: () => ID }) callId: string,
    @Args('deviceId', { nullable: true }) deviceId?: string,
  ): Promise<CallSessionGql> {
    const summary = await this.callingService.acceptCall(user.id, callId, deviceId);
    return summary as unknown as CallSessionGql;
  }

  @Mutation(() => Boolean, { description: 'Decline an incoming call' })
  @RequirePermissions(PermissionAction.CALL_DECLINE)
  async declineCall(
    @CurrentUser() user: AuthorizationSubject,
    @Args('callId', { type: () => ID }) callId: string,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<boolean> {
    await this.callingService.declineCall(user.id, callId, reason);
    return true;
  }

  @Mutation(() => Boolean, { description: 'Cancel an outgoing call before answer' })
  async cancelCall(
    @CurrentUser() user: AuthorizationSubject,
    @Args('callId', { type: () => ID }) callId: string,
  ): Promise<boolean> {
    await this.callingService.cancelCall(user.id, callId);
    return true;
  }

  @Mutation(() => CallSessionGql, { description: 'Join an active call' })
  @RequirePermissions(PermissionAction.CALL_JOIN)
  async joinCall(
    @CurrentUser() user: AuthorizationSubject,
    @Args('callId', { type: () => ID }) callId: string,
    @Args('deviceId', { nullable: true }) deviceId?: string,
  ): Promise<CallSessionGql> {
    const summary = await this.callingService.joinCall(user.id, callId, deviceId);
    return summary as unknown as CallSessionGql;
  }

  @Mutation(() => Boolean, { description: 'Leave an active call' })
  async leaveCall(
    @CurrentUser() user: AuthorizationSubject,
    @Args('callId', { type: () => ID }) callId: string,
  ): Promise<boolean> {
    await this.callingService.leaveCall(user.id, callId);
    return true;
  }

  @Mutation(() => Boolean, { description: 'End a call for all participants' })
  @RequirePermissions(PermissionAction.CALL_END)
  async endCall(
    @CurrentUser() user: AuthorizationSubject,
    @Args('callId', { type: () => ID }) callId: string,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<boolean> {
    await this.callingService.endCall(user.id, callId, reason);
    return true;
  }

  @Mutation(() => Boolean, { description: 'Mute or unmute a call participant' })
  @RequirePermissions(PermissionAction.CALL_MUTE_PARTICIPANT)
  async muteParticipant(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: MuteParticipantInput,
  ): Promise<boolean> {
    await this.callingService.muteParticipant(
      user.id,
      input.callId,
      input.targetUserId,
      input.isAudioMuted,
      input.isVideoMuted,
    );
    return true;
  }

  @Mutation(() => Boolean, { description: 'Remove a participant from the call' })
  @RequirePermissions(PermissionAction.CALL_REMOVE_PARTICIPANT)
  async removeParticipant(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: RemoveCallParticipantInput,
  ): Promise<boolean> {
    await this.callingService.removeParticipant(user.id, input.callId, input.targetUserId, input.reason);
    return true;
  }

  @Mutation(() => Boolean, { description: 'Put call on hold' })
  @RequirePermissions(PermissionAction.CALL_HOLD)
  async holdCall(
    @CurrentUser() user: AuthorizationSubject,
    @Args('callId', { type: () => ID }) callId: string,
  ): Promise<boolean> {
    await this.callingService.holdCall(user.id, callId);
    return true;
  }

  @Mutation(() => Boolean, { description: 'Resume call from hold' })
  @RequirePermissions(PermissionAction.CALL_HOLD)
  async resumeCall(
    @CurrentUser() user: AuthorizationSubject,
    @Args('callId', { type: () => ID }) callId: string,
  ): Promise<boolean> {
    await this.callingService.resumeCall(user.id, callId);
    return true;
  }

  @Mutation(() => Boolean, { description: 'Swap between active and held calls' })
  @RequirePermissions(PermissionAction.CALL_SWAP)
  async swapCalls(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: SwapCallsInput,
  ): Promise<boolean> {
    await this.callingService.swapCalls(user.id, input.holdCallId, input.resumeCallId);
    return true;
  }

  @Mutation(() => Boolean, { description: 'Perform blind call transfer' })
  @RequirePermissions(PermissionAction.CALL_CREATE)
  async blindTransfer(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: BlindTransferInput,
  ): Promise<boolean> {
    await this.callingService.blindTransfer(user.id, input.callId, input.targetUserId);
    return true;
  }

  @Mutation(() => CallSessionGql, { description: 'Initiate attended call transfer (creates consultation call)' })
  @RequirePermissions(PermissionAction.CALL_CREATE)
  async initiateAttendedTransfer(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: InitiateAttendedTransferInput,
  ): Promise<CallSessionGql> {
    const summary = await this.callingService.initiateAttendedTransfer(
      user.id,
      input.originalCallId,
      input.targetUserId,
    );
    return summary as unknown as CallSessionGql;
  }

  @Mutation(() => Boolean, { description: 'Complete attended call transfer' })
  @RequirePermissions(PermissionAction.CALL_CREATE)
  async completeAttendedTransfer(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: CompleteAttendedTransferInput,
  ): Promise<boolean> {
    await this.callingService.completeAttendedTransfer(user.id, input.transferCallId);
    return true;
  }

  @Mutation(() => Boolean, { description: 'Cancel attended call transfer' })
  @RequirePermissions(PermissionAction.CALL_CREATE)
  async cancelAttendedTransfer(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: CancelAttendedTransferInput,
  ): Promise<boolean> {
    await this.callingService.cancelAttendedTransfer(user.id, input.transferCallId);
    return true;
  }

  @Mutation(() => CallSessionGql, { description: 'Merge two calls into a single conference' })
  @RequirePermissions(PermissionAction.CALL_MERGE)
  async mergeCalls(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: MergeCallsInput,
  ): Promise<CallSessionGql> {
    const summary = await this.callingService.mergeCalls(user.id, input.callIdA, input.callIdB);
    return summary as unknown as CallSessionGql;
  }

  @Mutation(() => CallSessionGql, { description: 'Split participant out from conference into a private 1:1 call' })
  @RequirePermissions(PermissionAction.CALL_SPLIT)
  async splitConferenceCall(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: SplitConferenceCallInput,
  ): Promise<CallSessionGql> {
    const summary = await this.callingService.splitConferenceCall(
      user.id,
      input.conferenceId,
      input.participantUserId,
    );
    return summary as unknown as CallSessionGql;
  }

  @Mutation(() => Boolean, { description: 'Admit participant from waiting room' })
  @RequirePermissions(PermissionAction.CONFERENCE_MODERATE)
  async admitParticipant(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: AdmitParticipantInput,
  ): Promise<boolean> {
    await this.callingService.admitParticipant(user.id, input.callId, input.targetUserId);
    return true;
  }

  @Mutation(() => Boolean, { description: 'Deny participant from waiting room' })
  @RequirePermissions(PermissionAction.CONFERENCE_MODERATE)
  async denyParticipant(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: DenyParticipantInput,
  ): Promise<boolean> {
    await this.callingService.denyParticipant(user.id, input.callId, input.targetUserId);
    return true;
  }

  @Mutation(() => Boolean, { description: 'Lock or unlock conference' })
  @RequirePermissions(PermissionAction.CONFERENCE_LOCK)
  async lockConference(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: LockConferenceInput,
  ): Promise<boolean> {
    await this.callingService.lockConference(user.id, input.callId, input.isLocked);
    return true;
  }

  @Mutation(() => Boolean, { description: 'Start screen share in call' })
  @RequirePermissions(PermissionAction.CALL_JOIN)
  async startScreenShare(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: ScreenShareInput,
  ): Promise<boolean> {
    await this.callingService.startScreenShare(user.id, input.callId);
    return true;
  }

  @Mutation(() => Boolean, { description: 'Stop screen share in call' })
  @RequirePermissions(PermissionAction.CALL_JOIN)
  async stopScreenShare(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: ScreenShareInput,
  ): Promise<boolean> {
    await this.callingService.stopScreenShare(user.id, input.callId);
    return true;
  }

  @Mutation(() => CallDeviceTransferGql, { description: 'Initiate call transfer to another of current user devices' })
  @RequirePermissions(PermissionAction.DEVICE_HANDOFF)
  async initiateDeviceTransfer(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: InitiateDeviceTransferInput,
  ): Promise<CallDeviceTransferGql> {
    const transfer = await this.callingService.initiateDeviceTransfer(
      user.id,
      input.callId,
      input.targetDeviceId,
    );
    return transfer as unknown as CallDeviceTransferGql;
  }

  @Mutation(() => Boolean, { description: 'Complete seamless device handoff' })
  @RequirePermissions(PermissionAction.DEVICE_HANDOFF)
  async completeDeviceTransfer(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: CompleteDeviceTransferInput,
  ): Promise<boolean> {
    await this.callingService.completeDeviceTransfer(
      user.id,
      input.transferId,
    );
    return true;
  }

  @Mutation(() => RecordingSessionGql, { description: 'Start call recording' })
  @RequirePermissions(PermissionAction.RECORDING_START)
  async startRecording(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: StartRecordingInput,
  ): Promise<RecordingSessionGql> {
    const recording = await this.callingService.startRecording(
      user.id,
      input.callId,
      input.recordingType,
    );
    return recording as unknown as RecordingSessionGql;
  }

  @Mutation(() => Boolean, { description: 'Pause call recording' })
  @RequirePermissions(PermissionAction.RECORDING_PAUSE)
  async pauseRecording(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: PauseRecordingInput,
  ): Promise<boolean> {
    await this.callingService.pauseRecording(user.id, input.recordingId);
    return true;
  }

  @Mutation(() => Boolean, { description: 'Resume call recording' })
  @RequirePermissions(PermissionAction.RECORDING_RESUME)
  async resumeRecording(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: ResumeRecordingInput,
  ): Promise<boolean> {
    await this.callingService.resumeRecording(user.id, input.recordingId);
    return true;
  }

  @Mutation(() => Boolean, { description: 'Stop call recording' })
  @RequirePermissions(PermissionAction.RECORDING_STOP)
  async stopRecording(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: StopRecordingInput,
  ): Promise<boolean> {
    await this.callingService.stopRecording(user.id, input.recordingId);
    return true;
  }

  @Mutation(() => Boolean, { description: 'Submit or update recording consent' })
  @RequirePermissions(PermissionAction.CALL_JOIN)
  async submitRecordingConsent(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: SubmitRecordingConsentInput,
  ): Promise<boolean> {
    await this.callingService.submitRecordingConsent(
      user.id,
      input.recordingId,
      input.consented,
    );
    return true;
  }

  @Mutation(() => Boolean, { description: 'Delete call recording' })
  @RequirePermissions(PermissionAction.RECORDING_DELETE)
  async deleteRecording(
    @CurrentUser() user: AuthorizationSubject,
    @Args('recordingId', { type: () => ID }) recordingId: string,
  ): Promise<boolean> {
    await this.callingService.deleteRecording(user.id, recordingId);
    return true;
  }

  @Mutation(() => CallTranscriptGql, { description: 'Generate AI transcript for call or recording' })
  @RequirePermissions(PermissionAction.TRANSCRIPTION_VIEW)
  async transcribeCall(
    @CurrentUser() user: AuthorizationSubject,
    @Args('callId', { type: () => ID }) callId: string,
    @Args('recordingId', { type: () => ID, nullable: true }) recordingId?: string,
  ): Promise<CallTranscriptGql> {
    const transcript = await this.callingService.transcribeCall(user.id, callId, recordingId);
    return transcript as unknown as CallTranscriptGql;
  }

  @Mutation(() => ScheduledCallGql, { description: 'Schedule a future call' })
  @RequirePermissions(PermissionAction.CALL_SCHEDULE)
  async scheduleCall(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: ScheduleCallInput,
  ): Promise<ScheduledCallGql> {
    const scheduled = await this.callingService.scheduleCall(user.id, {
      title: input.title,
      description: input.description,
      scheduledStartTime: new Date(input.scheduledStartTime),
      scheduledEndTime: input.scheduledEndTime ? new Date(input.scheduledEndTime) : undefined,
      timezone: input.timezone || 'UTC',
      inviteeUserIds: input.inviteeUserIds || [],
      roomId: input.roomId,
      reminderMinutes: input.reminderMinutes,
    });
    return scheduled as unknown as ScheduledCallGql;
  }

  @Mutation(() => Boolean, { description: 'Cancel a scheduled call' })
  @RequirePermissions(PermissionAction.CALL_SCHEDULE)
  async cancelScheduledCall(
    @CurrentUser() user: AuthorizationSubject,
    @Args('scheduledCallId', { type: () => ID }) scheduledCallId: string,
  ): Promise<boolean> {
    await this.callingService.cancelScheduledCall(user.id, scheduledCallId);
    return true;
  }
}
