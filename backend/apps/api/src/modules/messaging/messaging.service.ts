import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttachmentStatus,
  ConversationRole,
  ConversationType,
  MessageDeliveryStatus,
  MessageType,
  ReportStatus,
} from '@nexavoice/domain-types';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { ContactsService } from '../contacts/contacts.service';
import { AttachmentsService } from './attachments.service';
import { SignalingGateway } from '../realtime/signaling.gateway';
import {
  EditMessageInput,
  MessageConnectionGql,
  MessageGql,
  MessagesPaginationInput,
  ReportContentInput,
  ReportResultGql,
  SendMessageInput,
} from './messaging.types';

import { OutboxWorker } from './outbox.worker';

@Injectable()
export class MessagingService {
  private readonly logger = new StructuredLogger('MessagingService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
    private readonly contactsService: ContactsService,
    private readonly attachmentsService: AttachmentsService,
    private readonly signalingGateway: SignalingGateway,
    private readonly outboxWorker: OutboxWorker,
  ) {}

  /**
   * Sends a message into a conversation with strict idempotency and monotonic sequence ordering.
   */
  async sendMessage(senderId: string, input: SendMessageInput): Promise<MessageGql> {
    const content = input.content.trim();
    if (!content && (!input.attachmentIds || input.attachmentIds.length === 0)) {
      throw new BadRequestException('Message must contain text content or an attachment');
    }

    if (!input.clientMessageId) {
      throw new BadRequestException('clientMessageId idempotency key is required');
    }

    // 1. Verify conversation access
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: input.conversationId },
      include: {
        participants: {
          include: { user: true },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const participant = conversation.participants.find((p) => p.userId === senderId);
    if (!participant) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    // For direct conversations, verify neither user has blocked the other
    if (conversation.type === ConversationType.DIRECT) {
      const other = conversation.participants.find((p) => p.userId !== senderId);
      if (other) {
        const isBlocked = await this.contactsService.isBlocked(senderId, other.userId);
        if (isBlocked) {
          throw new ForbiddenException('Cannot send message: conversation is blocked');
        }
      }
    }

    // 2. Idempotency Check: Return existing message if clientMessageId matches
    const existing = await this.prisma.message.findUnique({
      where: {
        conversationId_clientMessageId: {
          conversationId: input.conversationId,
          clientMessageId: input.clientMessageId,
        },
      },
      include: {
        sender: true,
        reactions: { include: { user: true } },
        attachments: true,
        replyTo: { include: { sender: true } },
      },
    });

    if (existing) {
      this.logger.log({
        event: 'idempotent_duplicate_message_returned',
        conversationId: input.conversationId,
        clientMessageId: input.clientMessageId,
        messageId: existing.id,
      });
      return this.mapMessage(existing);
    }

    // 3. Validate replyTo reference if supplied
    if (input.replyToMessageId) {
      const replyTarget = await this.prisma.message.findUnique({
        where: { id: input.replyToMessageId },
      });
      if (!replyTarget || replyTarget.conversationId !== input.conversationId) {
        throw new BadRequestException('Referenced reply message does not exist in this conversation');
      }
    }

    // 4. Transactionally increment conversation sequence and create message
    const createdMessage = await this.prisma.$transaction(async (tx) => {
      const updatedConv = await tx.conversation.update({
        where: { id: input.conversationId },
        data: {
          currentSequence: { increment: 1 },
          lastMessageAt: new Date(),
        },
        select: { currentSequence: true },
      });

      const message = await tx.message.create({
        data: {
          conversationId: input.conversationId,
          senderId,
          clientMessageId: input.clientMessageId,
          sequenceNumber: updatedConv.currentSequence,
          type: input.type,
          content,
          replyToMessageId: input.replyToMessageId,
          deliveryStatus: MessageDeliveryStatus.SENT,
        },
        include: {
          sender: true,
          reactions: { include: { user: true } },
          attachments: true,
          replyTo: { include: { sender: true } },
        },
      });

      // Link any pre-uploaded attachments
      if (input.attachmentIds && input.attachmentIds.length > 0) {
        await tx.attachment.updateMany({
          where: {
            id: { in: input.attachmentIds },
            uploaderId: senderId,
          },
          data: { messageId: message.id },
        });
      }

      // 5. Transactional Outbox: Atomically persist outbox event with message
      await tx.outboxEvent.create({
        data: {
          eventType: 'conversation.message.created',
          aggregateType: 'Conversation',
          aggregateId: input.conversationId,
          payloadJson: JSON.stringify(this.mapMessage(message)),
          status: 'PENDING',
          correlationId: message.id,
        },
      });

      return message;
    });

    // Re-fetch with attachments if attached
    let finalMessage = createdMessage;
    if (input.attachmentIds && input.attachmentIds.length > 0) {
      finalMessage = (await this.prisma.message.findUnique({
        where: { id: createdMessage.id },
        include: {
          sender: true,
          reactions: { include: { user: true } },
          attachments: true,
          replyTo: { include: { sender: true } },
        },
      })) || createdMessage;
    }

    const mapped = this.mapMessage(finalMessage);

    // 6. Asynchronously drain pending outbox events (outbox worker guarantees reliable delivery)
    this.outboxWorker.drainPendingEvents().catch((err) => {
      this.logger.warn({
        event: 'outbox_drain_after_send_failed',
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return mapped;
  }

  /**
   * Retrieves messages using cursor-based pagination.
   */
  async getMessages(
    userId: string,
    input: MessagesPaginationInput,
  ): Promise<MessageConnectionGql> {
    // Verify user is conversation participant
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const limit = Math.min(Math.max(input.limit || 30, 1), 100);
    const direction = input.direction || 'before';

    let sequenceCursor: number | null = null;
    if (input.cursor) {
      try {
        const decoded = Buffer.from(input.cursor, 'base64').toString('ascii');
        sequenceCursor = parseInt(decoded, 10);
      } catch {
        sequenceCursor = parseInt(input.cursor, 10);
      }
    }

    const whereClause: Record<string, unknown> = {
      conversationId: input.conversationId,
    };

    if (sequenceCursor !== null && !isNaN(sequenceCursor)) {
      if (direction === 'before') {
        whereClause['sequenceNumber'] = { lt: sequenceCursor };
      } else {
        whereClause['sequenceNumber'] = { gt: sequenceCursor };
      }
    }

    const messages = await this.prisma.message.findMany({
      where: whereClause,
      include: {
        sender: true,
        reactions: { include: { user: true } },
        attachments: true,
        replyTo: { include: { sender: true } },
      },
      orderBy: { sequenceNumber: direction === 'before' ? 'desc' : 'asc' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;

    // Order items ascending for standard chat reading order
    if (direction === 'before') {
      items.reverse();
    }

    const edges = items.map((msg) => ({
      cursor: Buffer.from(String(msg.sequenceNumber)).toString('base64'),
      node: this.mapMessage(msg),
    }));

    const totalCount = await this.prisma.message.count({
      where: { conversationId: input.conversationId },
    });

    return {
      edges,
      totalCount,
      pageInfo: {
        hasNextPage: direction === 'after' ? hasMore : false,
        hasPreviousPage: direction === 'before' ? hasMore : false,
        startCursor: edges.length > 0 ? edges[0].cursor : undefined,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : undefined,
      },
    };
  }

  /**
   * Edits message content. Only author can edit within valid window.
   */
  async editMessage(userId: string, input: EditMessageInput): Promise<MessageGql> {
    const message = await this.prisma.message.findUnique({
      where: { id: input.messageId },
      include: {
        sender: true,
        reactions: { include: { user: true } },
        attachments: true,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.deletedAt) {
      throw new BadRequestException('Cannot edit a deleted message');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('Only the author can edit this message');
    }

    const updated = await this.prisma.message.update({
      where: { id: input.messageId },
      data: {
        content: input.content.trim(),
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        sender: true,
        reactions: { include: { user: true } },
        attachments: true,
        replyTo: { include: { sender: true } },
      },
    });

    const mapped = this.mapMessage(updated);

    this.signalingGateway.broadcastToConversation(
      message.conversationId,
      'conversation.message.updated',
      mapped,
    );

    return mapped;
  }

  /**
   * Deletes a message (soft deletion preserving compliance retention).
   */
  async deleteMessage(userId: string, messageId: string): Promise<boolean> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: { participants: true },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const participant = message.conversation.participants.find((p) => p.userId === userId);
    if (!participant) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    // Author or group owner/admin can delete
    const isAuthor = message.senderId === userId;
    const isGroupAdmin =
      message.conversation.type === ConversationType.GROUP &&
      (participant.conversationRole === ConversationRole.OWNER ||
        participant.conversationRole === ConversationRole.ADMIN);

    if (!isAuthor && !isGroupAdmin) {
      throw new ForbiddenException('Not authorized to delete this message');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        content: '[This message was deleted]',
      },
    });

    this.signalingGateway.broadcastToConversation(
      message.conversationId,
      'conversation.message.deleted',
      {
        messageId,
        conversationId: message.conversationId,
        deletedAt: new Date().toISOString(),
      },
    );

    return true;
  }

  /**
   * Adds an emoji reaction to a message.
   */
  async addReaction(userId: string, messageId: string, reaction: string): Promise<MessageGql> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: { include: { participants: true } },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const isMember = message.conversation.participants.some((p) => p.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('Cannot react to messages in conversations you do not belong to');
    }

    await this.prisma.messageReaction.upsert({
      where: {
        messageId_userId_reaction: {
          messageId,
          userId,
          reaction,
        },
      },
      create: {
        messageId,
        userId,
        reaction,
      },
      update: {},
    });

    const updated = await this.prisma.message.findUniqueOrThrow({
      where: { id: messageId },
      include: {
        sender: true,
        reactions: { include: { user: true } },
        attachments: true,
        replyTo: { include: { sender: true } },
      },
    });

    const mapped = this.mapMessage(updated);

    this.signalingGateway.broadcastToConversation(
      message.conversationId,
      'conversation.reaction.added',
      {
        messageId,
        userId,
        reaction,
        conversationId: message.conversationId,
      },
    );

    return mapped;
  }

  /**
   * Removes a reaction from a message.
   */
  async removeReaction(userId: string, messageId: string, reaction: string): Promise<MessageGql> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.prisma.messageReaction.deleteMany({
      where: {
        messageId,
        userId,
        reaction,
      },
    });

    const updated = await this.prisma.message.findUniqueOrThrow({
      where: { id: messageId },
      include: {
        sender: true,
        reactions: { include: { user: true } },
        attachments: true,
        replyTo: { include: { sender: true } },
      },
    });

    const mapped = this.mapMessage(updated);

    this.signalingGateway.broadcastToConversation(
      message.conversationId,
      'conversation.reaction.removed',
      {
        messageId,
        userId,
        reaction,
        conversationId: message.conversationId,
      },
    );

    return mapped;
  }

  /**
   * Marks a conversation as read up to a message cursor for multi-device sync.
   */
  async markConversationRead(
    userId: string,
    conversationId: string,
    lastMessageId?: string,
  ): Promise<boolean> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException('Not a participant in this conversation');
    }

    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        lastReadMessageId: lastMessageId || participant.lastReadMessageId,
        lastReadAt: new Date(),
      },
    });

    this.signalingGateway.broadcastToConversation(
      conversationId,
      'conversation.message.read',
      {
        conversationId,
        userId,
        lastReadMessageId: lastMessageId,
        readAt: new Date().toISOString(),
      },
    );

    return true;
  }

  /**
   * Files a moderation report for a message or user.
   */
  async reportContent(reporterId: string, input: ReportContentInput): Promise<ReportResultGql> {
    const report = await this.prisma.messageReport.create({
      data: {
        reporterId,
        messageId: input.messageId,
        reportedUserId: input.reportedUserId,
        reason: input.reason,
        description: input.description,
        status: ReportStatus.PENDING,
      },
    });

    await this.securityAudit.logEvent({
      actorId: reporterId,
      action: 'CONTENT_REPORT_SUBMITTED',
      targetType: input.messageId ? 'Message' : 'User',
      targetId: input.messageId || input.reportedUserId,
      result: 'SUCCESS',
      metadata: { reason: input.reason },
    });

    return {
      reportId: report.id,
      status: report.status as ReportStatus,
      createdAt: report.createdAt.toISOString(),
    };
  }

  /**
   * Maps Prisma Message entity to GraphQL Message type.
   */
  private mapMessage(msg: any): MessageGql {
    return {
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      clientMessageId: msg.clientMessageId || undefined,
      sequenceNumber: msg.sequenceNumber,
      type: msg.type as MessageType,
      content: msg.content,
      replyToMessageId: msg.replyToMessageId || undefined,
      replyToMessage: msg.replyTo
        ? {
            id: msg.replyTo.id,
            conversationId: msg.replyTo.conversationId,
            senderId: msg.replyTo.senderId,
            sequenceNumber: msg.replyTo.sequenceNumber,
            type: msg.replyTo.type as MessageType,
            content: msg.replyTo.content,
            deliveryStatus: msg.replyTo.deliveryStatus as MessageDeliveryStatus,
            isEdited: msg.replyTo.isEdited,
            createdAt: msg.replyTo.createdAt.toISOString(),
            updatedAt: msg.replyTo.updatedAt.toISOString(),
            reactions: [],
            attachments: [],
            sender: {
              id: msg.replyTo.sender.id,
              nexaVoiceId: msg.replyTo.sender.nexaVoiceId,
              username: msg.replyTo.sender.username,
              displayName: msg.replyTo.sender.displayName,
              avatarUrl: msg.replyTo.sender.avatarUrl || undefined,
            },
          }
        : undefined,
      deliveryStatus: msg.deliveryStatus as MessageDeliveryStatus,
      isEdited: msg.isEdited,
      editedAt: msg.editedAt?.toISOString(),
      deletedAt: msg.deletedAt?.toISOString(),
      reactions: (msg.reactions || []).map((r: any) => ({
        id: r.id,
        messageId: r.messageId,
        userId: r.userId,
        reaction: r.reaction,
        createdAt: r.createdAt.toISOString(),
        user: {
          id: r.user?.id || r.userId,
          nexaVoiceId: r.user?.nexaVoiceId || '',
          username: r.user?.username || '',
          displayName: r.user?.displayName || 'User',
          avatarUrl: r.user?.avatarUrl || undefined,
        },
      })),
      attachments: (msg.attachments || []).map((a: any) => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        downloadUrl: this.attachmentsService.getAttachmentDownloadUrl(a.objectKey),
        status: a.status as AttachmentStatus,
        voiceDurationMs: a.voiceDurationMs || undefined,
        voiceFormat: a.voiceFormat || undefined,
      })),
      sender: {
        id: msg.sender.id,
        nexaVoiceId: msg.sender.nexaVoiceId,
        username: msg.sender.username,
        displayName: msg.sender.displayName,
        avatarUrl: msg.sender.avatarUrl || undefined,
      },
      createdAt: msg.createdAt.toISOString(),
      updatedAt: msg.updatedAt.toISOString(),
    };
  }
}
