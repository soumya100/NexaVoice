import { ForbiddenException } from '@nestjs/common';
import {
  MessageDeliveryStatus,
  MessageType,
} from '@nexavoice/domain-types';
import { MessagingService } from './messaging.service';

describe('MessagingService', () => {
  let service: MessagingService;
  let mockPrisma: any;
  let mockSecurityAudit: any;
  let mockContactsService: any;
  let mockAttachmentsService: any;
  let mockSignalingGateway: any;

  beforeEach(() => {
    mockSecurityAudit = {
      logEvent: jest.fn().mockResolvedValue({}),
    };

    mockContactsService = {
      isBlocked: jest.fn().mockResolvedValue(false),
    };

    mockAttachmentsService = {
      getAttachmentDownloadUrl: jest.fn((key) => `/download/${key}`),
    };

    mockSignalingGateway = {
      broadcastToConversation: jest.fn(),
      broadcastToUser: jest.fn(),
    };

    mockPrisma = {
      conversation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      conversationParticipant: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      message: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      messageReaction: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      attachment: {
        updateMany: jest.fn(),
      },
      messageReport: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    service = new MessagingService(
      mockPrisma,
      mockSecurityAudit,
      mockContactsService,
      mockAttachmentsService,
      mockSignalingGateway,
    );
  });

  describe('sendMessage', () => {
    it('throws ForbiddenException if user is not a participant in the conversation', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        participants: [{ userId: 'user-other' }],
      });

      await expect(
        service.sendMessage('user-alice', {
          conversationId: 'conv-1',
          clientMessageId: 'cli-msg-1',
          type: MessageType.TEXT,
          content: 'Hello world',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns existing message if clientMessageId matches (Idempotency)', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        participants: [{ userId: 'user-alice' }],
      });

      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-existing-1',
        conversationId: 'conv-1',
        senderId: 'user-alice',
        clientMessageId: 'cli-msg-duplicate',
        sequenceNumber: 42,
        type: MessageType.TEXT,
        content: 'Hello world',
        deliveryStatus: MessageDeliveryStatus.SENT,
        isEdited: false,
        reactions: [],
        attachments: [],
        sender: { id: 'user-alice', username: 'alice', displayName: 'Alice' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const message = await service.sendMessage('user-alice', {
        conversationId: 'conv-1',
        clientMessageId: 'cli-msg-duplicate',
        type: MessageType.TEXT,
        content: 'Hello world',
      });

      expect(message.id).toBe('msg-existing-1');
      expect(message.sequenceNumber).toBe(42);
      expect(mockPrisma.message.create).not.toHaveBeenCalled();
      expect(mockSignalingGateway.broadcastToConversation).not.toHaveBeenCalled();
    });

    it('creates message with monotonically incremented sequence and broadcasts realtime event', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        participants: [{ userId: 'user-alice' }],
      });

      mockPrisma.message.findUnique.mockResolvedValue(null);

      mockPrisma.conversation.update.mockResolvedValue({
        currentSequence: 43,
      });

      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-new-1',
        conversationId: 'conv-1',
        senderId: 'user-alice',
        clientMessageId: 'cli-msg-fresh',
        sequenceNumber: 43,
        type: MessageType.TEXT,
        content: 'Hello new message',
        deliveryStatus: MessageDeliveryStatus.SENT,
        isEdited: false,
        reactions: [],
        attachments: [],
        sender: { id: 'user-alice', username: 'alice', displayName: 'Alice' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const message = await service.sendMessage('user-alice', {
        conversationId: 'conv-1',
        clientMessageId: 'cli-msg-fresh',
        type: MessageType.TEXT,
        content: 'Hello new message',
      });

      expect(message.id).toBe('msg-new-1');
      expect(message.sequenceNumber).toBe(43);
      expect(mockSignalingGateway.broadcastToConversation).toHaveBeenCalledWith(
        'conv-1',
        'conversation.message.created',
        expect.objectContaining({ id: 'msg-new-1', sequenceNumber: 43 }),
      );
    });
  });

  describe('editMessage', () => {
    it('throws ForbiddenException if non-author attempts to edit', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        senderId: 'user-bob',
        deletedAt: null,
      });

      await expect(
        service.editMessage('user-alice', { messageId: 'msg-1', content: 'Hacked edit' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates message and marks isEdited: true', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'user-alice',
        deletedAt: null,
      });

      mockPrisma.message.update.mockResolvedValue({
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'user-alice',
        sequenceNumber: 10,
        type: MessageType.TEXT,
        content: 'Edited content',
        deliveryStatus: MessageDeliveryStatus.SENT,
        isEdited: true,
        editedAt: new Date(),
        reactions: [],
        attachments: [],
        sender: { id: 'user-alice', username: 'alice', displayName: 'Alice' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.editMessage('user-alice', {
        messageId: 'msg-1',
        content: 'Edited content',
      });

      expect(res.isEdited).toBe(true);
      expect(res.content).toBe('Edited content');
      expect(mockSignalingGateway.broadcastToConversation).toHaveBeenCalledWith(
        'conv-1',
        'conversation.message.updated',
        expect.anything(),
      );
    });
  });

  describe('deleteMessage', () => {
    it('soft deletes message and broadcasts realtime deleted event', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'user-alice',
        conversation: {
          type: 'DIRECT',
          participants: [{ userId: 'user-alice' }, { userId: 'user-bob' }],
        },
      });

      mockPrisma.message.update.mockResolvedValue({});

      const res = await service.deleteMessage('user-alice', 'msg-1');

      expect(res).toBe(true);
      expect(mockPrisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'msg-1' },
          data: expect.objectContaining({
            content: '[This message was deleted]',
            deletedAt: expect.any(Date),
          }),
        }),
      );
      expect(mockSignalingGateway.broadcastToConversation).toHaveBeenCalledWith(
        'conv-1',
        'conversation.message.deleted',
        expect.objectContaining({ messageId: 'msg-1' }),
      );
    });
  });

  describe('markConversationRead', () => {
    it('updates participant cursor and emits conversation.message.read', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({
        conversationId: 'conv-1',
        userId: 'user-alice',
        lastReadMessageId: 'msg-old',
      });

      mockPrisma.conversationParticipant.update.mockResolvedValue({});

      const res = await service.markConversationRead('user-alice', 'conv-1', 'msg-latest');

      expect(res).toBe(true);
      expect(mockPrisma.conversationParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastReadMessageId: 'msg-latest',
          }),
        }),
      );
      expect(mockSignalingGateway.broadcastToConversation).toHaveBeenCalledWith(
        'conv-1',
        'conversation.message.read',
        expect.objectContaining({
          conversationId: 'conv-1',
          userId: 'user-alice',
          lastReadMessageId: 'msg-latest',
        }),
      );
    });
  });
});
