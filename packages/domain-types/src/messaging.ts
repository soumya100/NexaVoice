export enum ConversationType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
  CHANNEL = 'CHANNEL',
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

export interface MessagePayload {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content: string;
  deliveryStatus: MessageDeliveryStatus;
  createdAt: string;
  updatedAt?: string;
  isEdited: boolean;
}
