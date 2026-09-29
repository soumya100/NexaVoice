export enum CallType {
  VOICE = 'VOICE',
  VIDEO = 'VIDEO',
  GROUP_VOICE = 'GROUP_VOICE',
  GROUP_VIDEO = 'GROUP_VIDEO',
  CONFERENCE = 'CONFERENCE',
  PERSISTENT_ROOM = 'PERSISTENT_ROOM',
  PSTN = 'PSTN',
}

export enum CallSessionStatus {
  NEW = 'NEW',
  INITIATING = 'INITIATING',
  RINGING = 'RINGING',
  CONNECTING = 'CONNECTING',
  ACTIVE = 'ACTIVE',
  HELD = 'HELD',
  ON_HOLD = 'ON_HOLD',
  INTERRUPTED = 'INTERRUPTED',
  ENDING = 'ENDING',
  ENDED = 'ENDED',
  FAILED = 'FAILED',
  MISSED = 'MISSED',
  REJECTED = 'REJECTED',
}

export const VALID_CALL_SESSION_TRANSITIONS: Record<CallSessionStatus, CallSessionStatus[]> = {
  [CallSessionStatus.NEW]: [
    CallSessionStatus.RINGING,
    CallSessionStatus.CONNECTING,
    CallSessionStatus.FAILED,
    CallSessionStatus.ENDED,
    CallSessionStatus.MISSED,
  ],
  [CallSessionStatus.INITIATING]: [
    CallSessionStatus.RINGING,
    CallSessionStatus.CONNECTING,
    CallSessionStatus.FAILED,
    CallSessionStatus.ENDED,
    CallSessionStatus.MISSED,
  ],
  [CallSessionStatus.RINGING]: [
    CallSessionStatus.CONNECTING,
    CallSessionStatus.ACTIVE,
    CallSessionStatus.MISSED,
    CallSessionStatus.REJECTED,
    CallSessionStatus.FAILED,
    CallSessionStatus.ENDED,
  ],
  [CallSessionStatus.CONNECTING]: [
    CallSessionStatus.ACTIVE,
    CallSessionStatus.FAILED,
    CallSessionStatus.ENDED,
  ],
  [CallSessionStatus.ACTIVE]: [
    CallSessionStatus.HELD,
    CallSessionStatus.ON_HOLD,
    CallSessionStatus.INTERRUPTED,
    CallSessionStatus.ENDING,
    CallSessionStatus.ENDED,
  ],
  [CallSessionStatus.HELD]: [
    CallSessionStatus.ACTIVE,
    CallSessionStatus.ENDING,
    CallSessionStatus.ENDED,
  ],
  [CallSessionStatus.ON_HOLD]: [
    CallSessionStatus.ACTIVE,
    CallSessionStatus.ENDING,
    CallSessionStatus.ENDED,
  ],
  [CallSessionStatus.INTERRUPTED]: [
    CallSessionStatus.ACTIVE,
    CallSessionStatus.CONNECTING,
    CallSessionStatus.ENDING,
    CallSessionStatus.ENDED,
    CallSessionStatus.FAILED,
  ],
  [CallSessionStatus.ENDING]: [
    CallSessionStatus.ENDED,
  ],
  [CallSessionStatus.ENDED]: [], // Terminal state
  [CallSessionStatus.FAILED]: [], // Terminal state
  [CallSessionStatus.MISSED]: [], // Terminal state
  [CallSessionStatus.REJECTED]: [], // Terminal state
};

export function canTransitionCallSession(from: CallSessionStatus, to: CallSessionStatus): boolean {
  if (from === to) return true;
  const normalizedFrom: CallSessionStatus =
    (from as any) === 'INITIATING' ? CallSessionStatus.INITIATING :
    (from as any) === 'ON_HOLD' ? CallSessionStatus.ON_HOLD : from;
  const allowed = VALID_CALL_SESSION_TRANSITIONS[normalizedFrom] || VALID_CALL_SESSION_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export enum CallLegStatus {
  CREATED = 'CREATED',
  INVITED = 'INVITED',
  RINGING = 'RINGING',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  HELD = 'HELD',
  TRANSFERRED = 'TRANSFERRED',
  ENDED = 'ENDED',
  FAILED = 'FAILED',
}

export const VALID_CALL_LEG_TRANSITIONS: Record<CallLegStatus, CallLegStatus[]> = {
  [CallLegStatus.CREATED]: [
    CallLegStatus.INVITED,
    CallLegStatus.RINGING,
    CallLegStatus.CONNECTING,
    CallLegStatus.FAILED,
    CallLegStatus.ENDED,
  ],
  [CallLegStatus.INVITED]: [
    CallLegStatus.RINGING,
    CallLegStatus.CONNECTING,
    CallLegStatus.FAILED,
    CallLegStatus.ENDED,
  ],
  [CallLegStatus.RINGING]: [
    CallLegStatus.CONNECTING,
    CallLegStatus.CONNECTED,
    CallLegStatus.FAILED,
    CallLegStatus.ENDED,
  ],
  [CallLegStatus.CONNECTING]: [
    CallLegStatus.CONNECTED,
    CallLegStatus.FAILED,
    CallLegStatus.ENDED,
  ],
  [CallLegStatus.CONNECTED]: [
    CallLegStatus.HELD,
    CallLegStatus.TRANSFERRED,
    CallLegStatus.ENDED,
    CallLegStatus.FAILED,
  ],
  [CallLegStatus.HELD]: [
    CallLegStatus.CONNECTED,
    CallLegStatus.TRANSFERRED,
    CallLegStatus.ENDED,
  ],
  [CallLegStatus.TRANSFERRED]: [
    CallLegStatus.ENDED,
  ],
  [CallLegStatus.ENDED]: [], // Terminal state
  [CallLegStatus.FAILED]: [], // Terminal state
};

export function canTransitionCallLeg(from: CallLegStatus, to: CallLegStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_CALL_LEG_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export enum ParticipantRole {
  HOST = 'HOST',
  CO_HOST = 'CO_HOST',
  PARTICIPANT = 'PARTICIPANT',
  SPEAKER = 'SPEAKER',
  LISTENER = 'LISTENER',
  AI_ASSISTANT = 'AI_ASSISTANT',
}

export enum ParticipantState {
  INVITED = 'INVITED',
  RINGING = 'RINGING',
  JOINING = 'JOINING',
  JOINED = 'JOINED',
  CONNECTED = 'CONNECTED',
  MUTED = 'MUTED',
  ON_HOLD = 'ON_HOLD',
  LEFT = 'LEFT',
  DISCONNECTED = 'DISCONNECTED',
  REMOVED = 'REMOVED',
  DECLINED = 'DECLINED',
  MISSED = 'MISSED',
}

export const VALID_PARTICIPANT_STATE_TRANSITIONS: Record<ParticipantState, ParticipantState[]> = {
  [ParticipantState.INVITED]: [
    ParticipantState.RINGING,
    ParticipantState.JOINING,
    ParticipantState.JOINED,
    ParticipantState.CONNECTED,
    ParticipantState.DECLINED,
    ParticipantState.MISSED,
    ParticipantState.REMOVED,
  ],
  [ParticipantState.RINGING]: [
    ParticipantState.JOINING,
    ParticipantState.JOINED,
    ParticipantState.CONNECTED,
    ParticipantState.DECLINED,
    ParticipantState.MISSED,
    ParticipantState.REMOVED,
  ],
  [ParticipantState.JOINING]: [
    ParticipantState.JOINED,
    ParticipantState.CONNECTED,
    ParticipantState.DISCONNECTED,
    ParticipantState.LEFT,
    ParticipantState.REMOVED,
  ],
  [ParticipantState.JOINED]: [
    ParticipantState.CONNECTED,
    ParticipantState.MUTED,
    ParticipantState.ON_HOLD,
    ParticipantState.DISCONNECTED,
    ParticipantState.LEFT,
    ParticipantState.REMOVED,
  ],
  [ParticipantState.CONNECTED]: [
    ParticipantState.MUTED,
    ParticipantState.ON_HOLD,
    ParticipantState.DISCONNECTED,
    ParticipantState.LEFT,
    ParticipantState.REMOVED,
  ],
  [ParticipantState.MUTED]: [
    ParticipantState.CONNECTED,
    ParticipantState.JOINED,
    ParticipantState.ON_HOLD,
    ParticipantState.DISCONNECTED,
    ParticipantState.LEFT,
    ParticipantState.REMOVED,
  ],
  [ParticipantState.ON_HOLD]: [
    ParticipantState.CONNECTED,
    ParticipantState.JOINED,
    ParticipantState.MUTED,
    ParticipantState.DISCONNECTED,
    ParticipantState.LEFT,
    ParticipantState.REMOVED,
  ],
  [ParticipantState.DISCONNECTED]: [
    ParticipantState.JOINING,
    ParticipantState.CONNECTED,
    ParticipantState.LEFT,
    ParticipantState.REMOVED,
  ],
  [ParticipantState.LEFT]: [], // Terminal state for session
  [ParticipantState.REMOVED]: [], // Terminal state for session
  [ParticipantState.DECLINED]: [], // Terminal state for session
  [ParticipantState.MISSED]: [], // Terminal state for session
};

export function canTransitionParticipant(from: ParticipantState, to: ParticipantState): boolean {
  if (from === to) return true;
  const allowed = VALID_PARTICIPANT_STATE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export enum MediaSessionStatus {
  INITIALIZING = 'INITIALIZING',
  OFFERED = 'OFFERED',
  ANSWERED = 'ANSWERED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RENEGOTIATING = 'RENEGOTIATING',
  FAILED = 'FAILED',
  CLOSED = 'CLOSED',
}

export const VALID_MEDIA_SESSION_TRANSITIONS: Record<MediaSessionStatus, MediaSessionStatus[]> = {
  [MediaSessionStatus.INITIALIZING]: [
    MediaSessionStatus.OFFERED,
    MediaSessionStatus.CONNECTING,
    MediaSessionStatus.FAILED,
    MediaSessionStatus.CLOSED,
  ],
  [MediaSessionStatus.OFFERED]: [
    MediaSessionStatus.ANSWERED,
    MediaSessionStatus.CONNECTING,
    MediaSessionStatus.FAILED,
    MediaSessionStatus.CLOSED,
  ],
  [MediaSessionStatus.ANSWERED]: [
    MediaSessionStatus.CONNECTING,
    MediaSessionStatus.CONNECTED,
    MediaSessionStatus.FAILED,
    MediaSessionStatus.CLOSED,
  ],
  [MediaSessionStatus.CONNECTING]: [
    MediaSessionStatus.CONNECTED,
    MediaSessionStatus.FAILED,
    MediaSessionStatus.CLOSED,
  ],
  [MediaSessionStatus.CONNECTED]: [
    MediaSessionStatus.RENEGOTIATING,
    MediaSessionStatus.FAILED,
    MediaSessionStatus.CLOSED,
  ],
  [MediaSessionStatus.RENEGOTIATING]: [
    MediaSessionStatus.CONNECTED,
    MediaSessionStatus.FAILED,
    MediaSessionStatus.CLOSED,
  ],
  [MediaSessionStatus.FAILED]: [
    MediaSessionStatus.INITIALIZING, // Retry / reconnect
    MediaSessionStatus.CLOSED,
  ],
  [MediaSessionStatus.CLOSED]: [], // Terminal state
};

export function canTransitionMediaSession(from: MediaSessionStatus, to: MediaSessionStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_MEDIA_SESSION_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export enum MediaMode {
  P2P_DIRECT = 'P2P_DIRECT',
  SFU_ROUTED = 'SFU_ROUTED',
}

export enum InvitationStatus {
  PENDING = 'PENDING',
  RINGING = 'RINGING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
  MISSED = 'MISSED',
}

export const VALID_INVITATION_TRANSITIONS: Record<InvitationStatus, InvitationStatus[]> = {
  [InvitationStatus.PENDING]: [
    InvitationStatus.RINGING,
    InvitationStatus.ACCEPTED,
    InvitationStatus.DECLINED,
    InvitationStatus.CANCELED,
    InvitationStatus.EXPIRED,
    InvitationStatus.MISSED,
  ],
  [InvitationStatus.RINGING]: [
    InvitationStatus.ACCEPTED,
    InvitationStatus.DECLINED,
    InvitationStatus.CANCELED,
    InvitationStatus.EXPIRED,
    InvitationStatus.MISSED,
  ],
  [InvitationStatus.ACCEPTED]: [],
  [InvitationStatus.DECLINED]: [],
  [InvitationStatus.CANCELED]: [],
  [InvitationStatus.EXPIRED]: [],
  [InvitationStatus.MISSED]: [],
};

export function canTransitionInvitation(from: InvitationStatus, to: InvitationStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_INVITATION_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export enum CallDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum RoomType {
  PRIVATE = 'PRIVATE',
  INVITE_ONLY = 'INVITE_ONLY',
  LINK_ACCESS = 'LINK_ACCESS',
  PUBLIC = 'PUBLIC',
}

export enum TransferStatus {
  INITIATED = 'INITIATED',
  CONSULTING = 'CONSULTING',
  ACCEPTED = 'ACCEPTED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface ParticipantPermissions {
  canMuteOthers: boolean;
  canRemoveParticipants: boolean;
  canInviteParticipants: boolean;
  canShareScreen: boolean;
  canRecord: boolean;
  canEndCall: boolean;
}

export interface CallParticipantSummary {
  participantId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: ParticipantRole;
  state: ParticipantState;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isOnHold: boolean;
  permissions: ParticipantPermissions;
  joinedAt: string;
  leftAt?: string;
}

export interface CallLegSummary {
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

export interface MediaSessionSummary {
  id: string;
  callSessionId: string;
  provider: string;
  mode: MediaMode;
  status: MediaSessionStatus;
  sfuRoomId?: string;
  iceServers: IceServerConfig[];
}

export interface CallSessionSummary {
  id: string;
  conversationId?: string;
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
  participants: CallParticipantSummary[];
  legs?: CallLegSummary[];
  mediaSession?: MediaSessionSummary;
}

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface SignalingPayload {
  callId: string;
  senderId: string;
  targetId?: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'mute' | 'hold' | 'leave' | 'renegotiate';
  data: unknown;
}

export interface CallOfferPayload {
  callId: string;
  sdp: string;
  type: 'offer';
  targetUserId?: string;
}

export interface CallAnswerPayload {
  callId: string;
  sdp: string;
  type: 'answer';
  targetUserId?: string;
}

export interface IceCandidateInit {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface CallIceCandidatePayload {
  callId: string;
  candidate: IceCandidateInit;
  targetUserId?: string;
}

// ==========================================
// MILESTONE 5: ADVANCED CALLING DOMAIN TYPES
// ==========================================

export enum WaitingRoomState {
  NONE = 'NONE',
  JOIN_REQUESTED = 'JOIN_REQUESTED',
  WAITING = 'WAITING',
  ADMITTED = 'ADMITTED',
  DENIED = 'DENIED',
}

export const VALID_WAITING_ROOM_TRANSITIONS: Record<WaitingRoomState, WaitingRoomState[]> = {
  [WaitingRoomState.NONE]: [
    WaitingRoomState.JOIN_REQUESTED,
    WaitingRoomState.WAITING,
  ],
  [WaitingRoomState.JOIN_REQUESTED]: [
    WaitingRoomState.WAITING,
    WaitingRoomState.ADMITTED,
    WaitingRoomState.DENIED,
  ],
  [WaitingRoomState.WAITING]: [
    WaitingRoomState.ADMITTED,
    WaitingRoomState.DENIED,
  ],
  [WaitingRoomState.ADMITTED]: [
    WaitingRoomState.NONE,
  ],
  [WaitingRoomState.DENIED]: [],
};

export function canTransitionWaitingRoom(from: WaitingRoomState, to: WaitingRoomState): boolean {
  if (from === to) return true;
  const allowed = VALID_WAITING_ROOM_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export enum ConferenceRole {
  HOST = 'HOST',
  MODERATOR = 'MODERATOR',
  PARTICIPANT = 'PARTICIPANT',
  VIEWER = 'VIEWER',
}

export enum RoomMemberRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  GUEST = 'GUEST',
}

export enum ScheduledCallStatus {
  SCHEDULED = 'SCHEDULED',
  STARTING = 'STARTING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  MISSED = 'MISSED',
}

export const VALID_SCHEDULED_CALL_TRANSITIONS: Record<ScheduledCallStatus, ScheduledCallStatus[]> = {
  [ScheduledCallStatus.SCHEDULED]: [
    ScheduledCallStatus.STARTING,
    ScheduledCallStatus.ACTIVE,
    ScheduledCallStatus.CANCELLED,
    ScheduledCallStatus.MISSED,
  ],
  [ScheduledCallStatus.STARTING]: [
    ScheduledCallStatus.ACTIVE,
    ScheduledCallStatus.CANCELLED,
    ScheduledCallStatus.MISSED,
  ],
  [ScheduledCallStatus.ACTIVE]: [
    ScheduledCallStatus.COMPLETED,
    ScheduledCallStatus.CANCELLED,
  ],
  [ScheduledCallStatus.COMPLETED]: [],
  [ScheduledCallStatus.CANCELLED]: [],
  [ScheduledCallStatus.MISSED]: [],
};

export function canTransitionScheduledCall(from: ScheduledCallStatus, to: ScheduledCallStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_SCHEDULED_CALL_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export enum DeviceTransferStatus {
  REQUESTED = 'REQUESTED',
  AUTHENTICATING = 'AUTHENTICATING',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export const VALID_DEVICE_TRANSFER_TRANSITIONS: Record<DeviceTransferStatus, DeviceTransferStatus[]> = {
  [DeviceTransferStatus.REQUESTED]: [
    DeviceTransferStatus.AUTHENTICATING,
    DeviceTransferStatus.CONNECTING,
    DeviceTransferStatus.CANCELLED,
    DeviceTransferStatus.FAILED,
  ],
  [DeviceTransferStatus.AUTHENTICATING]: [
    DeviceTransferStatus.CONNECTING,
    DeviceTransferStatus.CANCELLED,
    DeviceTransferStatus.FAILED,
  ],
  [DeviceTransferStatus.CONNECTING]: [
    DeviceTransferStatus.CONNECTED,
    DeviceTransferStatus.CANCELLED,
    DeviceTransferStatus.FAILED,
  ],
  [DeviceTransferStatus.CONNECTED]: [
    DeviceTransferStatus.COMPLETED,
    DeviceTransferStatus.FAILED,
  ],
  [DeviceTransferStatus.COMPLETED]: [],
  [DeviceTransferStatus.FAILED]: [],
  [DeviceTransferStatus.CANCELLED]: [],
};

export function canTransitionDeviceTransfer(from: DeviceTransferStatus, to: DeviceTransferStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_DEVICE_TRANSFER_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export enum RecordingStatus {
  REQUESTED = 'REQUESTED',
  CONSENT_PENDING = 'CONSENT_PENDING',
  STARTING = 'STARTING',
  RECORDING = 'RECORDING',
  PAUSED = 'PAUSED',
  STOPPING = 'STOPPING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DELETED = 'DELETED',
}

export const VALID_RECORDING_SESSION_TRANSITIONS: Record<RecordingStatus, RecordingStatus[]> = {
  [RecordingStatus.REQUESTED]: [
    RecordingStatus.CONSENT_PENDING,
    RecordingStatus.STARTING,
    RecordingStatus.FAILED,
    RecordingStatus.DELETED,
  ],
  [RecordingStatus.CONSENT_PENDING]: [
    RecordingStatus.STARTING,
    RecordingStatus.FAILED,
    RecordingStatus.DELETED,
  ],
  [RecordingStatus.STARTING]: [
    RecordingStatus.RECORDING,
    RecordingStatus.FAILED,
    RecordingStatus.DELETED,
  ],
  [RecordingStatus.RECORDING]: [
    RecordingStatus.PAUSED,
    RecordingStatus.STOPPING,
    RecordingStatus.COMPLETED,
    RecordingStatus.FAILED,
  ],
  [RecordingStatus.PAUSED]: [
    RecordingStatus.RECORDING,
    RecordingStatus.STOPPING,
    RecordingStatus.COMPLETED,
    RecordingStatus.FAILED,
  ],
  [RecordingStatus.STOPPING]: [
    RecordingStatus.COMPLETED,
    RecordingStatus.FAILED,
  ],
  [RecordingStatus.COMPLETED]: [
    RecordingStatus.DELETED,
  ],
  [RecordingStatus.FAILED]: [
    RecordingStatus.DELETED,
  ],
  [RecordingStatus.DELETED]: [],
};

export function canTransitionRecordingSession(from: RecordingStatus, to: RecordingStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_RECORDING_SESSION_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export enum RecordingType {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  SCREEN = 'SCREEN',
  COMBINED = 'COMBINED',
}

export enum ConsentState {
  PENDING = 'PENDING',
  GRANTED = 'GRANTED',
  DENIED = 'DENIED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum TranscriptStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface MultiCallPolicy {
  maxConcurrentCalls: number;
  maxActiveCalls: number;
  maxWaitingCalls: number;
}

export const DEFAULT_MULTI_CALL_POLICY: MultiCallPolicy = {
  maxConcurrentCalls: 2,
  maxActiveCalls: 1,
  maxWaitingCalls: 1,
};

export interface ConferenceSessionSummary {
  id: string;
  callSessionId: string;
  title: string;
  isLocked: boolean;
  allowScreenShare: boolean;
  allowParticipantUnmute: boolean;
  waitingRoomEnabled: boolean;
  maxParticipants: number;
  participants: ConferenceParticipantSummary[];
  createdAt: string;
}

export interface ConferenceParticipantSummary {
  id: string;
  conferenceSessionId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: ConferenceRole;
  waitingState: WaitingRoomState;
  joinedAt: string;
  leftAt?: string;
}

export interface ScheduledCallSummary {
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
  inviteeCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface DeviceTransferSummary {
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

export interface RecordingConsentSummary {
  id: string;
  recordingSessionId: string;
  participantUserId: string;
  policyVersion: string;
  consentState: ConsentState;
  consentedAt?: string;
  withdrawnAt?: string;
}

export interface RecordingSessionSummary {
  id: string;
  callSessionId: string;
  initiatorUserId: string;
  status: RecordingStatus;
  recordingType: RecordingType;
  durationSeconds: number;
  isLegalHold: boolean;
  retentionDays: number;
  startedAt?: string;
  stoppedAt?: string;
  playbackUrl?: string;
  consents: RecordingConsentSummary[];
}

export interface TranscriptSegmentSummary {
  id: string;
  speakerUserId?: string;
  speakerLabel: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence: number;
}

export interface CallTranscriptSummary {
  id: string;
  callSessionId: string;
  recordingSessionId?: string;
  provider: string;
  language: string;
  status: TranscriptStatus;
  fullText?: string;
  segments: TranscriptSegmentSummary[];
}

export interface RoomMemberSummary {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  role: RoomMemberRole;
  isBanned: boolean;
  joinedAt: string;
}

