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

export interface ParticipantPermissions {
  canMuteOthers: boolean;
  canRemoveParticipants: boolean;
  canInviteParticipants: boolean;
  canShareScreen: boolean;
  canRecord: boolean;
  canEndCall: boolean;
}

export interface CallParticipant {
  participantId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: ParticipantRole;
  state: ParticipantState;
  waitingState?: WaitingRoomState;
  admittedAt?: string;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isOnHold: boolean;
  permissions: ParticipantPermissions;
  joinedAt: string;
  leftAt?: string;
}

export interface CallLeg {
  id: string;
  callSessionId: string;
  userId: string;
  deviceId?: string;
  direction: CallDirection;
  status: CallLegStatus;
  startedAt: string;
  connectedAt?: string;
  endedAt?: string;
}

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface MediaSession {
  id: string;
  callSessionId: string;
  provider: string;
  mode: MediaMode;
  status: MediaSessionStatus;
  sfuRoomId?: string;
  iceServers: IceServer[];
}

export interface CallSession {
  id: string;
  conversationId?: string;
  parentCallSessionId?: string;
  callType: CallType;
  status: CallSessionStatus;
  hostUserId: string;
  roomName?: string;
  isPersistent: boolean;
  maxParticipants: number;
  startedAt: string;
  activeAt?: string;
  endedAt?: string;
  endReason?: string;
  participants: CallParticipant[];
  legs?: CallLeg[];
  mediaSession?: MediaSession;
}

export interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
}

export type WebRtcConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

export interface ConferenceParticipant {
  id: string;
  conferenceSessionId: string;
  userId: string;
  role: ConferenceRole;
  waitingState: WaitingRoomState;
  joinedAt: string;
  leftAt?: string;
}

export interface ConferenceSession {
  id: string;
  callSessionId: string;
  title: string;
  isLocked: boolean;
  allowScreenShare: boolean;
  allowParticipantUnmute: boolean;
  waitingRoomEnabled: boolean;
  maxParticipants: number;
  participants?: ConferenceParticipant[];
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledCallInvitee {
  id: string;
  scheduledCallId: string;
  userId: string;
  status: string;
}

export interface ScheduledCall {
  id: string;
  organizerId: string;
  roomId?: string;
  callSessionId?: string;
  title: string;
  description?: string;
  scheduledStartTime: string;
  scheduledEndTime?: string;
  timezone: string;
  status: ScheduledCallStatus;
  reminderMinutes: number;
  invitees?: ScheduledCallInvitee[];
  createdAt: string;
  updatedAt: string;
}

export interface CallDeviceTransfer {
  id: string;
  callSessionId: string;
  userId: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  status: DeviceTransferStatus;
  failureReason?: string;
  initiatedAt: string;
  completedAt?: string;
}

export interface RecordingConsent {
  id: string;
  recordingSessionId: string;
  participantUserId: string;
  consentState: ConsentState;
  consentedAt?: string;
}

export interface RecordingSession {
  id: string;
  callSessionId: string;
  initiatorUserId: string;
  status: RecordingStatus;
  recordingType: RecordingType;
  durationSeconds: number;
  startedAt?: string;
  pausedAt?: string;
  stoppedAt?: string;
  consents?: RecordingConsent[];
  createdAt: string;
}

export interface TranscriptSegment {
  id: string;
  speakerUserId?: string;
  speakerLabel: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence: number;
}

export interface CallTranscript {
  id: string;
  callSessionId: string;
  recordingSessionId?: string;
  status: TranscriptStatus;
  language: string;
  fullText?: string;
  segments?: TranscriptSegment[];
  createdAt: string;
}

export interface RecordingPlaybackUrl {
  recordingId: string;
  playbackUrl: string;
  expiresInSeconds: number;
}
