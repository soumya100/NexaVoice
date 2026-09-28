/**
 * NexaVoice Telephony & PSTN Domain Types
 * 
 * Formal definitions for Phone Numbers, Number Lifecycles, Routing,
 * SIP Trunks, Voicemail, Usage Records, and Telephony Provider Abstractions.
 */

export enum PhoneNumberType {
  LOCAL = 'LOCAL',
  MOBILE = 'MOBILE',
  TOLL_FREE = 'TOLL_FREE',
  GEOGRAPHIC = 'GEOGRAPHIC',
  NON_GEOGRAPHIC = 'NON_GEOGRAPHIC',
}

export enum PhoneNumberStatus {
  SEARCHING = 'SEARCHING',
  RESERVED = 'RESERVED',
  PROVISIONING = 'PROVISIONING',
  ACTIVE = 'ACTIVE',
  ASSIGNED = 'ASSIGNED',
  SUSPENDED = 'SUSPENDED',
  RELEASING = 'RELEASING',
  RELEASED = 'RELEASED',
  FAILED = 'FAILED',
}

export const VALID_PHONE_NUMBER_TRANSITIONS: Record<PhoneNumberStatus, PhoneNumberStatus[]> = {
  [PhoneNumberStatus.SEARCHING]: [
    PhoneNumberStatus.RESERVED,
    PhoneNumberStatus.FAILED,
  ],
  [PhoneNumberStatus.RESERVED]: [
    PhoneNumberStatus.PROVISIONING,
    PhoneNumberStatus.FAILED,
    PhoneNumberStatus.RELEASED,
  ],
  [PhoneNumberStatus.PROVISIONING]: [
    PhoneNumberStatus.ACTIVE,
    PhoneNumberStatus.FAILED,
  ],
  [PhoneNumberStatus.ACTIVE]: [
    PhoneNumberStatus.ASSIGNED,
    PhoneNumberStatus.SUSPENDED,
    PhoneNumberStatus.RELEASING,
  ],
  [PhoneNumberStatus.ASSIGNED]: [
    PhoneNumberStatus.ACTIVE, // Unassigned
    PhoneNumberStatus.SUSPENDED,
    PhoneNumberStatus.RELEASING,
  ],
  [PhoneNumberStatus.SUSPENDED]: [
    PhoneNumberStatus.ACTIVE,
    PhoneNumberStatus.ASSIGNED,
    PhoneNumberStatus.RELEASING,
    PhoneNumberStatus.RELEASED,
  ],
  [PhoneNumberStatus.RELEASING]: [
    PhoneNumberStatus.RELEASED,
    PhoneNumberStatus.FAILED,
  ],
  [PhoneNumberStatus.RELEASED]: [], // Terminal state
  [PhoneNumberStatus.FAILED]: [
    PhoneNumberStatus.RELEASING,
    PhoneNumberStatus.RELEASED,
  ],
};

export function canTransitionPhoneNumber(from: PhoneNumberStatus, to: PhoneNumberStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_PHONE_NUMBER_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export enum PhoneNumberAssignmentType {
  USER = 'USER',
  ROOM = 'ROOM',
  ORGANIZATION = 'ORGANIZATION',
  ROUTING_RULE = 'ROUTING_RULE',
}

export interface TelephonyProviderCapabilities {
  outboundCalling: boolean;
  inboundCalling: boolean;
  sipTrunking: boolean;
  numberProvisioning: boolean;
  numberPorting: boolean;
  recording: boolean;
  transcription: boolean;
  dtmf: boolean;
  transfer: boolean;
  emergencyCalling: boolean;
  statusCallbacks: boolean;
}

export enum RoutingTargetType {
  USER = 'USER',
  ROOM = 'ROOM',
  VOICEMAIL = 'VOICEMAIL',
  QUEUE = 'QUEUE',
  EXTERNAL_NUMBER = 'EXTERNAL_NUMBER',
  REJECT = 'REJECT',
}

export interface RoutingRuleSummary {
  id: string;
  phoneNumberId: string;
  name: string;
  priority: number;
  targetType: RoutingTargetType;
  targetId?: string;
  fallbackTargetType?: RoutingTargetType;
  fallbackTargetId?: string;
  ringDurationSeconds: number;
  businessHoursOnly: boolean;
  enabled: boolean;
  createdAt: string;
}

export enum SipTrunkAuthMode {
  IP_ACCESS_LIST = 'IP_ACCESS_LIST',
  CREDENTIAL = 'CREDENTIAL',
}

export enum SipTransport {
  UDP = 'UDP',
  TCP = 'TCP',
  TLS = 'TLS',
}

export enum SipTrunkStatus {
  INACTIVE = 'INACTIVE',
  PROVISIONING = 'PROVISIONING',
  ACTIVE = 'ACTIVE',
  FAILED = 'FAILED',
  SUSPENDED = 'SUSPENDED',
}

export interface SipTrunkSummary {
  id: string;
  name: string;
  provider: string;
  domain: string;
  authMode: SipTrunkAuthMode;
  transport: SipTransport;
  region: string;
  status: SipTrunkStatus;
  maxConcurrentCalls: number;
  createdAt: string;
}

export enum VoicemailStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export interface VoicemailMessageSummary {
  id: string;
  callSessionId: string;
  recordingSessionId?: string;
  callerNumber: string;
  callerName?: string;
  recipientUserId: string;
  durationSeconds: number;
  status: VoicemailStatus;
  transcript?: string;
  audioUrl?: string;
  createdAt: string;
}

export interface TelephonyUsageSummary {
  id: string;
  callSessionId: string;
  provider: string;
  providerCallId?: string;
  sourceNumber: string;
  destinationNumber: string;
  direction: 'INBOUND' | 'OUTBOUND';
  durationSeconds: number;
  callStatus: string;
  region?: string;
  startedAt: string;
  endedAt?: string;
}

export interface PhoneNumberSummary {
  id: string;
  e164Number: string;
  displayNumber: string;
  countryCode: string;
  type: PhoneNumberType;
  status: PhoneNumberStatus;
  provider: string;
  providerResourceId?: string;
  assignedType?: PhoneNumberAssignmentType;
  assignedId?: string;
  assignedName?: string;
  capabilities: string[];
  createdAt: string;
  releasedAt?: string;
}

export interface DtmfPayload {
  callId: string;
  digits: string;
  durationMs?: number;
}
