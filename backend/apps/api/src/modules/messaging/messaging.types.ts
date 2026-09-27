import { Field, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  AttachmentStatus,
  MessageDeliveryStatus,
  MessageType,
  ReportStatus,
} from '@nexavoice/domain-types';
import { ContactUserSummaryGql } from '../contacts/contacts.types';

registerEnumType(MessageType, {
  name: 'MessageType',
  description: 'Type of message payload (TEXT, IMAGE, FILE, VOICE, SYSTEM)',
});

registerEnumType(MessageDeliveryStatus, {
  name: 'MessageDeliveryStatus',
  description: 'Message delivery status (PENDING, SENT, DELIVERED, READ, FAILED)',
});

registerEnumType(AttachmentStatus, {
  name: 'AttachmentStatus',
  description: 'Security scan status of attachment',
});

registerEnumType(ReportStatus, {
  name: 'ReportStatus',
  description: 'Moderation status of report',
});

@ObjectType('MessageAttachment')
export class MessageAttachmentGql {
  @Field(() => ID)
  id!: string;

  @Field()
  fileName!: string;

  @Field()
  mimeType!: string;

  @Field(() => Int)
  sizeBytes!: number;

  @Field()
  downloadUrl!: string;

  @Field(() => AttachmentStatus)
  status!: AttachmentStatus;

  @Field(() => Int, { nullable: true })
  voiceDurationMs?: number;

  @Field({ nullable: true })
  voiceFormat?: string;
}

@ObjectType('MessageReaction')
export class MessageReactionGql {
  @Field(() => ID)
  id!: string;

  @Field()
  messageId!: string;

  @Field()
  userId!: string;

  @Field()
  reaction!: string;

  @Field()
  createdAt!: string;

  @Field(() => ContactUserSummaryGql)
  user!: ContactUserSummaryGql;
}

@ObjectType('Message')
export class MessageGql {
  @Field(() => ID)
  id!: string;

  @Field()
  conversationId!: string;

  @Field()
  senderId!: string;

  @Field({ nullable: true })
  clientMessageId?: string;

  @Field(() => Int)
  sequenceNumber!: number;

  @Field(() => MessageType)
  type!: MessageType;

  @Field()
  content!: string;

  @Field({ nullable: true })
  replyToMessageId?: string;

  @Field(() => MessageGql, { nullable: true })
  replyToMessage?: MessageGql;

  @Field(() => MessageDeliveryStatus)
  deliveryStatus!: MessageDeliveryStatus;

  @Field()
  isEdited!: boolean;

  @Field({ nullable: true })
  editedAt?: string;

  @Field({ nullable: true })
  deletedAt?: string;

  @Field(() => [MessageReactionGql])
  reactions!: MessageReactionGql[];

  @Field(() => [MessageAttachmentGql])
  attachments!: MessageAttachmentGql[];

  @Field(() => ContactUserSummaryGql)
  sender!: ContactUserSummaryGql;

  @Field()
  createdAt!: string;

  @Field()
  updatedAt!: string;
}

@ObjectType('PageInfo')
export class PageInfoGql {
  @Field()
  hasNextPage!: boolean;

  @Field()
  hasPreviousPage!: boolean;

  @Field({ nullable: true })
  startCursor?: string;

  @Field({ nullable: true })
  endCursor?: string;
}

@ObjectType('MessageEdge')
export class MessageEdgeGql {
  @Field()
  cursor!: string;

  @Field(() => MessageGql)
  node!: MessageGql;
}

@ObjectType('MessageConnection')
export class MessageConnectionGql {
  @Field(() => [MessageEdgeGql])
  edges!: MessageEdgeGql[];

  @Field(() => PageInfoGql)
  pageInfo!: PageInfoGql;

  @Field(() => Int)
  totalCount!: number;
}

@InputType('SendMessageInput')
export class SendMessageInput {
  @Field(() => ID)
  conversationId!: string;

  @Field({ description: 'Client-generated idempotency key' })
  clientMessageId!: string;

  @Field(() => MessageType, { defaultValue: MessageType.TEXT })
  type!: MessageType;

  @Field()
  content!: string;

  @Field({ nullable: true })
  replyToMessageId?: string;

  @Field(() => [String], { nullable: true, description: 'Optional attachment IDs' })
  attachmentIds?: string[];
}

@InputType('EditMessageInput')
export class EditMessageInput {
  @Field(() => ID)
  messageId!: string;

  @Field()
  content!: string;
}

@InputType('UploadAttachmentInitInput')
export class UploadAttachmentInitInput {
  @Field()
  fileName!: string;

  @Field()
  mimeType!: string;

  @Field(() => Int)
  sizeBytes!: number;

  @Field(() => Int, { nullable: true, description: 'Duration in ms if voice message' })
  voiceDurationMs?: number;

  @Field({ nullable: true, description: 'Format e.g. webm/opus, m4a' })
  voiceFormat?: string;
}

@ObjectType('UploadAttachmentInitResult')
export class UploadAttachmentInitResultGql {
  @Field(() => ID)
  attachmentId!: string;

  @Field()
  uploadUrl!: string;

  @Field()
  objectKey!: string;

  @Field()
  expiresInSeconds!: number;
}

@InputType('ReportContentInput')
export class ReportContentInput {
  @Field({ nullable: true })
  messageId?: string;

  @Field({ nullable: true })
  reportedUserId?: string;

  @Field()
  reason!: string;

  @Field({ nullable: true })
  description?: string;
}

@ObjectType('ReportResult')
export class ReportResultGql {
  @Field(() => ID)
  reportId!: string;

  @Field(() => ReportStatus)
  status!: ReportStatus;

  @Field()
  createdAt!: string;
}

@InputType('MessagesPaginationInput')
export class MessagesPaginationInput {
  @Field(() => ID)
  conversationId!: string;

  @Field(() => Int, { nullable: true, defaultValue: 30 })
  limit!: number;

  @Field({ nullable: true, description: 'Cursor pointing to message sequence or ID' })
  cursor?: string;

  @Field({ nullable: true, defaultValue: 'before', description: 'Pagination direction: before or after' })
  direction?: 'before' | 'after';
}

@ObjectType('LinkPreviewResult')
export class LinkPreviewResultGql {
  @Field()
  url!: string;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  image?: string;
}
