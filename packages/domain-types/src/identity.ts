import { AccountState } from './authorization';

export enum UserStatus {
  ONLINE = 'ONLINE',
  IN_CALL = 'IN_CALL',
  BUSY = 'BUSY',
  AWAY = 'AWAY',
  OFFLINE = 'OFFLINE',
}

export interface UserSummary {
  id: string;
  nexaVoiceId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  status: UserStatus;
  accountState: AccountState;
  customStatus?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: string;
}

export interface DeviceInfo {
  id: string;
  deviceId: string;
  deviceType: 'WEB' | 'IOS' | 'ANDROID' | 'DESKTOP';
  deviceName: string;
  platform?: string;
  appVersion?: string;
  ipAddress?: string;
  lastActiveAt: string;
  isTrusted: boolean;
}
