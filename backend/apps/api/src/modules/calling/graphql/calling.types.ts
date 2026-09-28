import { Field, Float, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  CallType,
  CallSessionStatus,
  ParticipantRole,
  ParticipantState,
  CallLegStatus,
  CallDirection,
  MediaMode,
  MediaSessionStatus,
  WaitingRoomState,
  ConferenceRole,
  ScheduledCallStatus,
  DeviceTransferStatus,
  RecordingStatus,
  RecordingType,
  ConsentState,
  TranscriptStatus,
} from '@nexavoice/domain-types';

registerEnumType(CallType, { name: 'CallType' });
registerEnumType(CallSessionStatus, { name: 'CallSessionStatus' });
registerEnumType(ParticipantRole, { name: 'ParticipantRole' });
registerEnumType(ParticipantState, { name: 'ParticipantState' });
registerEnumType(CallLegStatus, { name: 'CallLegStatus' });
registerEnumType(CallDirection, { name: 'CallDirection' });
registerEnumType(MediaMode, { name: 'MediaMode' });
registerEnumType(MediaSessionStatus, { name: 'MediaSessionStatus' });
registerEnumType(WaitingRoomState, { name: 'WaitingRoomState' });
registerEnumType(ConferenceRole, { name: 'ConferenceRole' });
registerEnumType(ScheduledCallStatus, { name: 'ScheduledCallStatus' });
registerEnumType(DeviceTransferStatus, { name: 'DeviceTransferStatus' });
registerEnumType(RecordingStatus, { name: 'RecordingStatus' });
registerEnumType(RecordingType, { name: 'RecordingType' });
registerEnumType(ConsentState, { name: 'ConsentState' });
registerEnumType(TranscriptStatus, { name: 'TranscriptStatus' });


@ObjectType()
export class ParticipantPermissionsGql {
  @Field(() => Boolean)
  canMuteOthers!: boolean;

  @Field(() => Boolean)
  canRemoveParticipants!: boolean;

  @Field(() => Boolean)
  canInviteParticipants!: boolean;

  @Field(() => Boolean)
  canShareScreen!: boolean;

  @Field(() => Boolean)
  canRecord!: boolean;

  @Field(() => Boolean)
  canEndCall!: boolean;
}

@ObjectType()
export class CallParticipantGql {
  @Field(() => ID)
  participantId!: string;

  @Field(() => ID)
  userId!: string;

  @Field(() => String)
  displayName!: string;

  @Field(() => String, { nullable: true })
  avatarUrl?: string;

  @Field(() => ParticipantRole)
  role!: ParticipantRole;

  @Field(() => ParticipantState)
  state!: ParticipantState;

  @Field(() => Boolean)
  isAudioMuted!: boolean;

  @Field(() => Boolean)
  isVideoMuted!: boolean;

  @Field(() => Boolean)
  isScreenSharing!: boolean;

  @Field(() => Boolean)
  isOnHold!: boolean;

  @Field(() => WaitingRoomState, { nullable: true })
  waitingState?: WaitingRoomState;

  @Field(() => String, { nullable: true })
  admittedAt?: string;

  @Field(() => ParticipantPermissionsGql)
  permissions!: ParticipantPermissionsGql;

  @Field(() => String)
  joinedAt!: string;

  @Field(() => String, { nullable: true })
  leftAt?: string;
}

@ObjectType()
export class CallLegGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  callSessionId!: string;

  @Field(() => ID)
  userId!: string;

  @Field(() => String, { nullable: true })
  deviceId?: string;

  @Field(() => CallDirection)
  direction!: CallDirection;

  @Field(() => CallLegStatus)
  status!: CallLegStatus;

  @Field(() => String)
  startedAt!: string;

  @Field(() => String, { nullable: true })
  connectedAt?: string;

  @Field(() => String, { nullable: true })
  endedAt?: string;
}

@ObjectType()
export class IceServerConfigGql {
  @Field(() => [String])
  urls!: string[];

  @Field(() => String, { nullable: true })
  username?: string;

  @Field(() => String, { nullable: true })
  credential?: string;
}

@ObjectType()
export class MediaSessionGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  callSessionId!: string;

  @Field(() => String)
  provider!: string;

  @Field(() => MediaMode)
  mode!: MediaMode;

  @Field(() => MediaSessionStatus)
  status!: MediaSessionStatus;

  @Field(() => String, { nullable: true })
  sfuRoomId?: string;

  @Field(() => [IceServerConfigGql])
  iceServers!: IceServerConfigGql[];
}

@ObjectType()
export class CallSessionGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID, { nullable: true })
  conversationId?: string;

  @Field(() => ID, { nullable: true })
  parentCallSessionId?: string;

  @Field(() => CallType)
  callType!: CallType;

  @Field(() => CallSessionStatus)
  status!: CallSessionStatus;

  @Field(() => ID)
  hostUserId!: string;

  @Field(() => String, { nullable: true })
  roomName?: string;

  @Field(() => Boolean)
  isPersistent!: boolean;

  @Field(() => Int)
  maxParticipants!: number;

  @Field(() => String)
  startedAt!: string;

  @Field(() => String, { nullable: true })
  activeAt?: string;

  @Field(() => String, { nullable: true })
  endedAt?: string;

  @Field(() => String, { nullable: true })
  endReason?: string;

  @Field(() => [CallParticipantGql])
  participants!: CallParticipantGql[];

  @Field(() => [CallLegGql], { nullable: true })
  legs?: CallLegGql[];

  @Field(() => MediaSessionGql, { nullable: true })
  mediaSession?: MediaSessionGql;
}

@InputType()
export class InitiateCallInput {
  @Field(() => CallType)
  callType!: CallType;

  @Field(() => [ID])
  inviteeUserIds!: string[];

  @Field(() => ID, { nullable: true })
  conversationId?: string;

  @Field(() => String, { nullable: true })
  roomName?: string;

  @Field(() => Int, { nullable: true })
  maxParticipants?: number;

  @Field(() => String, { nullable: true })
  scheduledStartTime?: string;

  @Field(() => String, { nullable: true })
  timezone?: string;
}

@InputType()
export class MuteParticipantInput {
  @Field(() => ID)
  callId!: string;

  @Field(() => ID)
  targetUserId!: string;

  @Field(() => Boolean, { nullable: true })
  isAudioMuted?: boolean;

  @Field(() => Boolean, { nullable: true })
  isVideoMuted?: boolean;
}

@InputType()
export class RemoveCallParticipantInput {
  @Field(() => ID)
  callId!: string;

  @Field(() => ID)
  targetUserId!: string;

  @Field(() => String, { nullable: true })
  reason?: string;
}

@ObjectType()
export class ConferenceParticipantGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  conferenceSessionId!: string;

  @Field(() => ID)
  userId!: string;

  @Field(() => ConferenceRole)
  role!: ConferenceRole;

  @Field(() => WaitingRoomState)
  waitingState!: WaitingRoomState;

  @Field(() => String)
  joinedAt!: string;

  @Field(() => String, { nullable: true })
  leftAt?: string;
}

@ObjectType()
export class ConferenceSessionGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  callSessionId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => Boolean)
  isLocked!: boolean;

  @Field(() => Boolean)
  allowScreenShare!: boolean;

  @Field(() => Boolean)
  allowParticipantUnmute!: boolean;

  @Field(() => Boolean)
  waitingRoomEnabled!: boolean;

  @Field(() => Int)
  maxParticipants!: number;

  @Field(() => [ConferenceParticipantGql], { nullable: true })
  participants?: ConferenceParticipantGql[];

  @Field(() => String)
  createdAt!: string;

  @Field(() => String)
  updatedAt!: string;
}

@ObjectType()
export class ScheduledCallInviteeGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  scheduledCallId!: string;

  @Field(() => ID)
  userId!: string;

  @Field(() => String)
  status!: string;
}

@ObjectType()
export class ScheduledCallGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  organizerId!: string;

  @Field(() => ID, { nullable: true })
  roomId?: string;

  @Field(() => ID, { nullable: true })
  callSessionId?: string;

  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String)
  scheduledStartTime!: string;

  @Field(() => String, { nullable: true })
  scheduledEndTime?: string;

  @Field(() => String)
  timezone!: string;

  @Field(() => ScheduledCallStatus)
  status!: ScheduledCallStatus;

  @Field(() => Int)
  reminderMinutes!: number;

  @Field(() => [ScheduledCallInviteeGql], { nullable: true })
  invitees?: ScheduledCallInviteeGql[];

  @Field(() => String)
  createdAt!: string;

  @Field(() => String, { nullable: true })
  updatedAt?: string;
}

@ObjectType()
export class CallDeviceTransferGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  callSessionId!: string;

  @Field(() => ID)
  userId!: string;

  @Field(() => String)
  sourceDeviceId!: string;

  @Field(() => String)
  targetDeviceId!: string;

  @Field(() => DeviceTransferStatus)
  status!: DeviceTransferStatus;

  @Field(() => String, { nullable: true })
  failureReason?: string;

  @Field(() => String)
  initiatedAt!: string;

  @Field(() => String, { nullable: true })
  completedAt?: string;
}

@ObjectType()
export class RecordingConsentGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  recordingSessionId!: string;

  @Field(() => ID)
  participantUserId!: string;

  @Field(() => ConsentState)
  consentState!: ConsentState;

  @Field(() => String, { nullable: true })
  consentedAt?: string;
}

@ObjectType()
export class RecordingSessionGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  callSessionId!: string;

  @Field(() => ID)
  initiatorUserId!: string;

  @Field(() => RecordingStatus)
  status!: RecordingStatus;

  @Field(() => RecordingType)
  recordingType!: RecordingType;

  @Field(() => Int)
  durationSeconds!: number;

  @Field(() => String, { nullable: true })
  startedAt?: string;

  @Field(() => String, { nullable: true })
  pausedAt?: string;

  @Field(() => String, { nullable: true })
  stoppedAt?: string;

  @Field(() => [RecordingConsentGql], { nullable: true })
  consents?: RecordingConsentGql[];

  @Field(() => String)
  createdAt!: string;
}

@ObjectType()
export class TranscriptSegmentGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID, { nullable: true })
  speakerUserId?: string;

  @Field(() => String)
  speakerLabel!: string;

  @Field(() => Int)
  startMs!: number;

  @Field(() => Int)
  endMs!: number;

  @Field(() => String)
  text!: string;

  @Field(() => Float)
  confidence!: number;
}

@ObjectType()
export class CallTranscriptGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  callSessionId!: string;

  @Field(() => ID, { nullable: true })
  recordingSessionId?: string;

  @Field(() => TranscriptStatus)
  status!: TranscriptStatus;

  @Field(() => String)
  language!: string;

  @Field(() => String, { nullable: true })
  fullText?: string;

  @Field(() => [TranscriptSegmentGql], { nullable: true })
  segments?: TranscriptSegmentGql[];

  @Field(() => String)
  createdAt!: string;
}

@ObjectType()
export class RecordingPlaybackUrlGql {
  @Field(() => ID)
  recordingId!: string;

  @Field(() => String)
  playbackUrl!: string;

  @Field(() => Int)
  expiresInSeconds!: number;
}

@InputType()
export class SwapCallsInput {
  @Field(() => ID)
  holdCallId!: string;

  @Field(() => ID)
  resumeCallId!: string;
}

@InputType()
export class BlindTransferInput {
  @Field(() => ID)
  callId!: string;

  @Field(() => ID)
  targetUserId!: string;
}

@InputType()
export class InitiateAttendedTransferInput {
  @Field(() => ID)
  originalCallId!: string;

  @Field(() => ID)
  targetUserId!: string;
}

@InputType()
export class CompleteAttendedTransferInput {
  @Field(() => ID)
  transferCallId!: string;
}

@InputType()
export class CancelAttendedTransferInput {
  @Field(() => ID)
  transferCallId!: string;
}

@InputType()
export class MergeCallsInput {
  @Field(() => ID)
  callIdA!: string;

  @Field(() => ID)
  callIdB!: string;
}

@InputType()
export class SplitConferenceCallInput {
  @Field(() => ID)
  conferenceId!: string;

  @Field(() => ID)
  participantUserId!: string;
}

@InputType()
export class AdmitParticipantInput {
  @Field(() => ID)
  callId!: string;

  @Field(() => ID)
  targetUserId!: string;
}

@InputType()
export class DenyParticipantInput {
  @Field(() => ID)
  callId!: string;

  @Field(() => ID)
  targetUserId!: string;
}

@InputType()
export class LockConferenceInput {
  @Field(() => ID)
  callId!: string;

  @Field(() => Boolean)
  isLocked!: boolean;
}

@InputType()
export class ScreenShareInput {
  @Field(() => ID)
  callId!: string;
}

@InputType()
export class InitiateDeviceTransferInput {
  @Field(() => ID)
  callId!: string;

  @Field(() => String)
  targetDeviceId!: string;
}

@InputType()
export class CompleteDeviceTransferInput {
  @Field(() => ID)
  callId!: string;

  @Field(() => ID)
  transferId!: string;

  @Field(() => String)
  sourceDeviceId!: string;

  @Field(() => String)
  targetDeviceId!: string;
}

@InputType()
export class StartRecordingInput {
  @Field(() => ID)
  callId!: string;

  @Field(() => RecordingType, { nullable: true, defaultValue: RecordingType.COMBINED })
  recordingType?: RecordingType;
}

@InputType()
export class PauseRecordingInput {
  @Field(() => ID)
  callId!: string;

  @Field(() => ID)
  recordingId!: string;
}

@InputType()
export class ResumeRecordingInput {
  @Field(() => ID)
  callId!: string;

  @Field(() => ID)
  recordingId!: string;
}

@InputType()
export class StopRecordingInput {
  @Field(() => ID)
  callId!: string;

  @Field(() => ID)
  recordingId!: string;
}

@InputType()
export class SubmitRecordingConsentInput {
  @Field(() => ID)
  callId!: string;

  @Field(() => ID)
  recordingId!: string;

  @Field(() => Boolean)
  consented!: boolean;
}

@InputType()
export class ScheduleCallInput {
  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String)
  scheduledStartTime!: string;

  @Field(() => String, { nullable: true })
  scheduledEndTime?: string;

  @Field(() => String, { nullable: true, defaultValue: 'UTC' })
  timezone?: string;

  @Field(() => [ID], { nullable: true, defaultValue: [] })
  inviteeUserIds?: string[];

  @Field(() => ID, { nullable: true })
  roomId?: string;

  @Field(() => Int, { nullable: true, defaultValue: 15 })
  reminderMinutes?: number;
}

