export type PhoneNumberStatus =
  | 'SEARCHING'
  | 'RESERVED'
  | 'PROVISIONING'
  | 'ACTIVE'
  | 'ASSIGNED'
  | 'SUSPENDED'
  | 'RELEASING'
  | 'RELEASED'
  | 'FAILED';

export type PhoneNumberType = 'LOCAL' | 'TOLL_FREE' | 'MOBILE' | 'GEOGRAPHIC';

export type PhoneNumberAssignmentType = 'USER' | 'TEAM' | 'ORGANIZATION' | 'ROOM' | 'ROUTING_ENDPOINT';

export type RoutingTargetType = 'USER' | 'ROOM' | 'TEAM' | 'VOICEMAIL' | 'QUEUE' | 'FORWARD' | 'REJECT';

export type VoicemailStatus = 'UNREAD' | 'READ' | 'ARCHIVED' | 'DELETED';

export interface PhoneNumberGql {
  id: string;
  e164Number: string;
  displayNumber: string;
  countryCode: string;
  type: PhoneNumberType;
  provider: string;
  providerResourceId?: string;
  status: PhoneNumberStatus;
  assignedToType?: PhoneNumberAssignmentType;
  assignedId?: string;
  emergencyAddressId?: string;
  createdAt: string;
  updatedAt: string;
  releasedAt?: string;
}

export interface RoutingRuleGql {
  id: string;
  phoneNumberId: string;
  priority: number;
  name: string;
  targetType: RoutingTargetType;
  targetId: string;
  ringDurationSeconds: number;
  businessHoursOnly: boolean;
  businessHoursStart?: string;
  businessHoursEnd?: string;
  timezone?: string;
  fallbackTargetType?: RoutingTargetType;
  fallbackTargetId?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VoicemailMessageGql {
  id: string;
  callSessionId: string;
  recordingSessionId?: string;
  callerNumber: string;
  recipientUserId: string;
  durationSeconds: number;
  transcript?: string;
  audioStorageKey?: string;
  status: VoicemailStatus;
  createdAt: string;
  readAt?: string;
}

export interface TelephonyUsageGql {
  id: string;
  callSessionId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  provider: string;
  providerCallId: string;
  sourceNumber: string;
  destinationNumber: string;
  durationSeconds: number;
  callStatus: string;
  costEstimateCents?: number;
  currency?: string;
  startedAt: string;
  answeredAt?: string;
  endedAt?: string;
  createdAt: string;
}

export interface OutboundTelephonyPolicyGql {
  allowedCountries: string[];
  maxCallDurationSeconds: number;
  allowHighRiskDestinations: boolean;
  maxCallsPerMinute: number;
  maxConcurrentCalls: number;
  defaultCallerId?: string;
}

export interface TelephonyCallResultGql {
  callId: string;
  providerCallId?: string;
  provider?: string;
  status: string;
  destinationNumber: string;
  callerId?: string;
}
