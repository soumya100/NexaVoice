export enum AccountState {
  ACTIVE = 'ACTIVE',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  SUSPENDED = 'SUSPENDED',
  LOCKED = 'LOCKED',
  DEACTIVATED = 'DEACTIVATED',
  DELETED = 'DELETED',
}

/**
 * Valid state transitions for AccountState state machine.
 */
export const VALID_ACCOUNT_STATE_TRANSITIONS: Record<AccountState, AccountState[]> = {
  [AccountState.PENDING_VERIFICATION]: [AccountState.ACTIVE, AccountState.DELETED],
  [AccountState.ACTIVE]: [AccountState.SUSPENDED, AccountState.LOCKED, AccountState.DEACTIVATED, AccountState.DELETED],
  [AccountState.SUSPENDED]: [AccountState.ACTIVE, AccountState.DELETED],
  [AccountState.LOCKED]: [AccountState.ACTIVE, AccountState.SUSPENDED, AccountState.DELETED],
  [AccountState.DEACTIVATED]: [AccountState.ACTIVE, AccountState.DELETED],
  [AccountState.DELETED]: [], // Terminal state
};

export function canTransitionAccountState(from: AccountState, to: AccountState): boolean {
  if (from === to) return true;
  const allowed = VALID_ACCOUNT_STATE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export enum SystemRole {
  USER = 'USER',
  MODERATOR = 'MODERATOR',
  COMMUNITY_ADMIN = 'COMMUNITY_ADMIN',
  ROOM_HOST = 'ROOM_HOST',
  DEVELOPER = 'DEVELOPER',
  SUPPORT_AGENT = 'SUPPORT_AGENT',
  SECURITY_ADMIN = 'SECURITY_ADMIN',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
}

export enum PermissionAction {
  // Identity & Profile
  IDENTITY_READ = 'identity.read',
  IDENTITY_UPDATE = 'identity.update',
  PROFILE_READ = 'profile.read',
  PROFILE_UPDATE = 'profile.update',

  // Contacts
  CONTACT_READ = 'contact.read',
  CONTACT_MANAGE = 'contact.manage',

  // Conversations
  CONVERSATION_READ = 'conversation.read',
  CONVERSATION_WRITE = 'conversation.write',
  CONVERSATION_DELETE = 'conversation.delete',

  // Messages
  MESSAGE_READ = 'message.read',
  MESSAGE_SEND = 'message.send',
  MESSAGE_EDIT = 'message.edit',
  MESSAGE_DELETE = 'message.delete',

  // Calling & Advanced Controls
  CALL_CREATE = 'call.create',
  CALL_JOIN = 'call.join',
  CALL_ANSWER = 'call.answer',
  CALL_DECLINE = 'call.decline',
  CALL_HOLD = 'call.hold',
  CALL_INVITE = 'call.invite',
  CALL_REMOVE_PARTICIPANT = 'call.remove_participant',
  CALL_MUTE_PARTICIPANT = 'call.mute_participant',
  CALL_SCREEN_SHARE = 'call.screen_share',
  CALL_TRANSFER = 'call.transfer',
  CALL_END = 'call.end',
  CALL_SWAP = 'call.swap',
  CALL_MERGE = 'call.merge',
  CALL_SPLIT = 'call.split',
  CALL_SCHEDULE = 'call.schedule',
  DEVICE_HANDOFF = 'call.device_handoff',

  // Conferencing & Rooms
  CONFERENCE_CREATE = 'conference.create',
  CONFERENCE_MANAGE = 'conference.manage',
  CONFERENCE_MODERATE = 'conference.moderate',
  CONFERENCE_LOCK = 'conference.lock',
  ROOM_MANAGE = 'room.manage',
  ROOM_MEMBER_MANAGE = 'room.member_manage',

  // Recording & Consent & Transcripts
  RECORDING_START = 'recording.start',
  RECORDING_STOP = 'recording.stop',
  RECORDING_PAUSE = 'recording.pause',
  RECORDING_RESUME = 'recording.resume',
  RECORDING_ACCESS = 'recording.access',
  RECORDING_DELETE = 'recording.delete',
  TRANSCRIPTION_VIEW = 'transcription.view',

  // AI Assistant
  AI_READ = 'ai.read',
  AI_CONFIGURE = 'ai.configure',
  AI_LISTEN = 'ai.listen',
  AI_SPEAK = 'ai.speak',
  AI_JOIN_CALL = 'ai.join_call',
  AI_SEND_MESSAGE = 'ai.send_message',
  AI_MAKE_CALL = 'ai.make_call',
  AI_TRANSFER_CALL = 'ai.transfer_call',
  AI_END_CALL = 'ai.end_call',

  // Telephony & PSTN & SIP
  TELEPHONY_PSTN_CALL = 'telephony.pstn_call',
  TELEPHONY_INTERNATIONAL_CALL = 'telephony.international_call',
  TELEPHONY_NUMBER_PROVISION = 'telephony.number.provision',
  TELEPHONY_NUMBER_ASSIGN = 'telephony.number.assign',
  TELEPHONY_NUMBER_RELEASE = 'telephony.number.release',
  TELEPHONY_ROUTING_MANAGE = 'telephony.routing.manage',
  TELEPHONY_SIP_TRUNK_MANAGE = 'telephony.sip_trunk.manage',
  TELEPHONY_VOICEMAIL_ACCESS = 'telephony.voicemail.access',
  TELEPHONY_USAGE_READ = 'telephony.usage.read',

  // AI Voice & Call Intelligence (Milestone 7)
  AI_AGENT_MANAGE = 'ai.agent.manage',
  AI_CALL_PARTICIPATE = 'ai.call.participate',
  AI_CALL_OUTBOUND = 'ai.call.outbound',
  AI_TOOLS_EXECUTE = 'ai.tools.execute',
  AI_TRANSCRIPT_READ = 'ai.transcript.read',
  AI_SUMMARIZE = 'ai.summarize',

  // Security & Admin
  SECURITY_VIEW_AUDIT = 'security.view_audit',
  SECURITY_MANAGE_SESSIONS = 'security.manage_sessions',
}

export enum Capability {
  CALL_HOST = 'CALL_HOST',
  ROOM_MODERATOR = 'ROOM_MODERATOR',
  RECORDING_MANAGER = 'RECORDING_MANAGER',
  AI_OPERATOR = 'AI_OPERATOR',
  COMMUNITY_MODERATOR = 'COMMUNITY_MODERATOR',
  DEVELOPER_APP_OWNER = 'DEVELOPER_APP_OWNER',
}

export interface AuthorizationSubject {
  id: string;
  nexaVoiceId: string;
  accountState: AccountState;
  roles: string[];
  permissions: string[];
  sessionId?: string;
  deviceId?: string;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason: string;
  policyVersion: string;
  evaluatedAt: string;
  obligations?: string[];
}

export interface AuthTokenPayload {
  sub: string;
  nexaVoiceId: string;
  sid: string;
  tokenVersion: number;
  roles: string[];
  iat?: number;
  exp?: number;
}
