export enum AIParticipationStatus {
  STANDBY = 'STANDBY',
  LISTENING = 'LISTENING',
  ANALYZING = 'ANALYZING',
  SPEAKING = 'SPEAKING',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  EXECUTING_ACTION = 'EXECUTING_ACTION',
}

export enum AIActionType {
  MESSAGE_SUMMARY = 'MESSAGE_SUMMARY',
  CALL_SCREENING = 'CALL_SCREENING',
  SCHEDULE_MEETING = 'SCHEDULE_MEETING',
  SEND_FOLLOW_UP = 'SEND_FOLLOW_UP',
  TRANSFER_CALL = 'TRANSFER_CALL',
  CREATE_TASK = 'CREATE_TASK',
}

export enum AIActionApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  AUTO_APPROVED = 'AUTO_APPROVED',
}

export interface AIProfileSummary {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  voiceStyle: string;
  personality: string;
  language: string;
  autoScreeningEnabled: boolean;
  canSpeakInCalls: boolean;
  canSummarizeRecordings: boolean;
}

export interface AIActionRequest {
  id: string;
  actionType: AIActionType;
  description: string;
  confidenceScore: number;
  requiresHumanApproval: boolean;
  status: AIActionApprovalStatus;
  payload: Record<string, unknown>;
  createdAt: string;
}
