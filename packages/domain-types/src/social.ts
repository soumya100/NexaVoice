export enum PresenceStatus {
  ONLINE = 'ONLINE',
  AWAY = 'AWAY',
  BUSY = 'BUSY',
  DO_NOT_DISTURB = 'DO_NOT_DISTURB',
  OFFLINE = 'OFFLINE',
}

export enum UserAvailability {
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
  IN_CALL = 'IN_CALL',
  DO_NOT_DISTURB = 'DO_NOT_DISTURB',
  UNAVAILABLE = 'UNAVAILABLE',
}

export interface UserPresenceDto {
  userId: string;
  status: PresenceStatus;
  customStatus?: string;
  activeDeviceCount: number;
  lastHeartbeatAt: string;
  isOnline: boolean;
  availability: UserAvailability;
}

export enum NotificationType {
  MESSAGE = 'MESSAGE',
  MISSED_CALL = 'MISSED_CALL',
  CALL_INCOMING = 'CALL_INCOMING',
  CONTACT_REQUEST = 'CONTACT_REQUEST',
  CONTACT_ACCEPTED = 'CONTACT_ACCEPTED',
  ROOM_INVITE = 'ROOM_INVITE',
  MEETING_SCHEDULED = 'MEETING_SCHEDULED',
  MENTION = 'MENTION',
  AI_SUMMARY = 'AI_SUMMARY',
  SYSTEM = 'SYSTEM',
}

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export interface NotificationDto {
  id: string;
  userId: string;
  actorId?: string;
  actor?: {
    id: string;
    nexaVoiceId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  type: NotificationType;
  title: string;
  body: string;
  priority: NotificationPriority;
  dataJson?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationPreferenceDto {
  id: string;
  userId: string;
  messagesInApp: boolean;
  messagesEmail: boolean;
  callsInApp: boolean;
  callsEmail: boolean;
  contactRequestsInApp: boolean;
  contactRequestsEmail: boolean;
  mentionsInApp: boolean;
  mentionsEmail: boolean;
  aiSummariesInApp: boolean;
  aiSummariesEmail: boolean;
  globalMute: boolean;
  muteUntil?: string;
}

export interface ContactGroupDto {
  id: string;
  userId: string;
  name: string;
  color?: string;
  memberCount: number;
  members?: {
    id: string;
    contactUserId: string;
    contactUser: {
      id: string;
      nexaVoiceId: string;
      username: string;
      displayName: string;
      avatarUrl?: string;
    };
    addedAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMemberDto {
  userId: string;
  organizationId: string;
  displayName: string;
  username: string;
  email?: string;
  department?: string;
  jobTitle?: string;
  avatarUrl?: string;
  presence?: UserPresenceDto;
}
