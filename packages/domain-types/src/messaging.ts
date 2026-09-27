export enum ConversationType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
  CHANNEL = 'CHANNEL',
}

export enum ConversationRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum ContactRelationshipStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  BLOCKED = 'BLOCKED',
  REMOVED = 'REMOVED',
}

export enum PrivacyLevel {
  EVERYONE = 'EVERYONE',
  CONTACTS_ONLY = 'CONTACTS_ONLY',
  NOBODY = 'NOBODY',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  VOICE = 'VOICE',
  CALL_EVENT = 'CALL_EVENT',
  AI_EVENT = 'AI_EVENT',
  SYSTEM = 'SYSTEM',
}

export enum MessageDeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export enum AttachmentStatus {
  CLEAN = 'CLEAN',
  PENDING_SCAN = 'PENDING_SCAN',
  QUARANTINED = 'QUARANTINED',
  REJECTED = 'REJECTED',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  ACTIONED = 'ACTIONED',
  DISMISSED = 'DISMISSED',
}

export interface MessageReactionDto {
  id: string;
  messageId: string;
  userId: string;
  reaction: string;
  createdAt: string;
}

export interface AttachmentDto {
  id: string;
  uploaderId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  voiceDurationMs?: number;
  voiceFormat?: string;
  createdAt: string;
}

export interface MessageDetail {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId?: string;
  sequenceNumber: number;
  type: MessageType;
  content: string;
  replyToMessageId?: string;
  deliveryStatus: MessageDeliveryStatus;
  isEdited: boolean;
  editedAt?: string;
  isDeleted: boolean;
  reactions: MessageReactionDto[];
  attachments: AttachmentDto[];
  createdAt: string;
  updatedAt?: string;
}

export interface ConversationSummary {
  id: string;
  type: ConversationType;
  title?: string;
  description?: string;
  avatarUrl?: string;
  unreadCount: number;
  lastMessage?: MessageDetail;
  participantCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

export interface MessageConnection {
  items: MessageDetail[];
  pageInfo: PageInfo;
  totalCount: number;
}
