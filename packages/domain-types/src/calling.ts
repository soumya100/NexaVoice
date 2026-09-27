export enum CallType {
  VOICE = 'VOICE',
  VIDEO = 'VIDEO',
  CONFERENCE = 'CONFERENCE',
  PSTN = 'PSTN',
}

export enum CallSessionStatus {
  INITIATING = 'INITIATING',
  RINGING = 'RINGING',
  CONNECTING = 'CONNECTING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  ENDED = 'ENDED',
  FAILED = 'FAILED',
  MISSED = 'MISSED',
  REJECTED = 'REJECTED',
}

export enum ParticipantRole {
  HOST = 'HOST',
  CO_HOST = 'CO_HOST',
  PARTICIPANT = 'PARTICIPANT',
  AI_ASSISTANT = 'AI_ASSISTANT',
}

export enum ParticipantState {
  INVITED = 'INVITED',
  RINGING = 'RINGING',
  JOINED = 'JOINED',
  MUTED = 'MUTED',
  ON_HOLD = 'ON_HOLD',
  LEFT = 'LEFT',
  DISCONNECTED = 'DISCONNECTED',
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
  joinedAt: string;
}

export interface CallSessionSummary {
  id: string;
  conversationId?: string;
  callType: CallType;
  status: CallSessionStatus;
  hostUserId: string;
  startedAt: string;
  endedAt?: string;
  participants: CallParticipantSummary[];
}

export interface SignalingPayload {
  callId: string;
  senderId: string;
  targetId?: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'mute' | 'hold' | 'leave';
  data: unknown;
}
