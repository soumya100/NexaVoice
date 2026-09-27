export enum UserStatus {
  ONLINE = 'ONLINE',
  IN_CALL = 'IN_CALL',
  BUSY = 'BUSY',
  AWAY = 'AWAY',
  OFFLINE = 'OFFLINE',
}

export enum UserRole {
  USER = 'USER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
}

export interface UserSummary {
  id: string;
  nexaVoiceId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  status: UserStatus;
  customStatus?: string;
  createdAt: string;
}

export interface DeviceInfo {
  id: string;
  deviceId: string;
  deviceType: 'WEB' | 'MOBILE' | 'DESKTOP' | 'TABLET';
  deviceName: string;
  ipAddress?: string;
  lastActiveAt: string;
  isTrusted: boolean;
}
