import { CallType } from '@nexavoice/domain-types';

export interface InitiateCallDto {
  callType: CallType;
  inviteeUserIds: string[];
  conversationId?: string;
  roomName?: string;
  maxParticipants?: number;
  scheduledStartTime?: Date;
  timezone?: string;
  metadata?: Record<string, unknown>;
}

export interface MuteParticipantDto {
  callId: string;
  targetUserId: string;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
}

export interface RemoveParticipantDto {
  callId: string;
  targetUserId: string;
  reason?: string;
}
