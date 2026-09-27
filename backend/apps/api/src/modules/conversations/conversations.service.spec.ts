import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConversationRole, ConversationType } from '@nexavoice/domain-types';
import { ConversationsService } from './conversations.service';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let mockPrisma: any;
  let mockSecurityAudit: any;
  let mockContactsService: any;

  beforeEach(() => {
    mockSecurityAudit = {
      logEvent: jest.fn().mockResolvedValue({}),
    };

    mockContactsService = {
      isBlocked: jest.fn().mockResolvedValue(false),
    };

    mockPrisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      conversation: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      conversationParticipant: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    service = new ConversationsService(
      mockPrisma,
      mockSecurityAudit,
      mockContactsService,
    );
  });

  describe('getOrCreateDirectConversation', () => {
    it('throws BadRequestException if user targets themselves', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-alice',
        username: 'alice',
      });

      await expect(
        service.getOrCreateDirectConversation('user-alice', { targetUserId: 'alice' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException if users are blocked', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-bob',
        username: 'bob',
      });
      mockContactsService.isBlocked.mockResolvedValue(true);

      await expect(
        service.getOrCreateDirectConversation('user-alice', { targetUserId: 'bob' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deterministically sorts user IDs for direct conversation identity', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-alice',
        username: 'alice',
      });
      mockContactsService.isBlocked.mockResolvedValue(false);

      // Suppose user-alice < user-bob alphabetically
      mockPrisma.conversation.findUnique.mockResolvedValueOnce(null);

      mockPrisma.conversation.create.mockResolvedValue({
        id: 'conv-123',
        type: ConversationType.DIRECT,
        currentSequence: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [
          {
            id: 'p-1',
            userId: 'user-alice',
            conversationRole: ConversationRole.MEMBER,
            joinedAt: new Date(),
            isMuted: false,
            user: { id: 'user-alice', username: 'alice', displayName: 'Alice' },
          },
          {
            id: 'p-2',
            userId: 'user-bob',
            conversationRole: ConversationRole.MEMBER,
            joinedAt: new Date(),
            isMuted: false,
            user: { id: 'user-bob', username: 'bob', displayName: 'Bob' },
          },
        ],
      });

      const conv = await service.getOrCreateDirectConversation('user-bob', { targetUserId: 'user-alice' });

      expect(conv.id).toBe('conv-123');
      expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            directUserAId: 'user-alice',
            directUserBId: 'user-bob',
          }),
        }),
      );
    });

    it('returns existing direct conversation without creating duplicate', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-bob',
        username: 'bob',
      });
      mockContactsService.isBlocked.mockResolvedValue(false);

      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-existing',
        type: ConversationType.DIRECT,
        currentSequence: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [
          {
            id: 'p-1',
            userId: 'user-alice',
            conversationRole: ConversationRole.MEMBER,
            joinedAt: new Date(),
            isMuted: false,
            user: { id: 'user-alice', username: 'alice', displayName: 'Alice' },
          },
          {
            id: 'p-2',
            userId: 'user-bob',
            conversationRole: ConversationRole.MEMBER,
            joinedAt: new Date(),
            isMuted: false,
            user: { id: 'user-bob', username: 'bob', displayName: 'Bob' },
          },
        ],
      });

      const conv = await service.getOrCreateDirectConversation('user-alice', { targetUserId: 'bob' });

      expect(conv.id).toBe('conv-existing');
      expect(mockPrisma.conversation.create).not.toHaveBeenCalled();
    });
  });

  describe('createGroupConversation', () => {
    it('creates group conversation with creator assigned as OWNER', async () => {
      mockContactsService.isBlocked.mockResolvedValue(false);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-bob',
        privacySettings: null,
      });

      mockPrisma.conversation.create.mockResolvedValue({
        id: 'group-1',
        type: ConversationType.GROUP,
        title: 'Project Engineering',
        currentSequence: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [
          {
            id: 'p-1',
            userId: 'user-alice',
            conversationRole: ConversationRole.OWNER,
            joinedAt: new Date(),
            isMuted: false,
            user: { id: 'user-alice', username: 'alice', displayName: 'Alice' },
          },
          {
            id: 'p-2',
            userId: 'user-bob',
            conversationRole: ConversationRole.MEMBER,
            joinedAt: new Date(),
            isMuted: false,
            user: { id: 'user-bob', username: 'bob', displayName: 'Bob' },
          },
        ],
      });

      const group = await service.createGroupConversation('user-alice', {
        title: 'Project Engineering',
        participantUserIds: ['user-bob'],
      });

      expect(group.title).toBe('Project Engineering');
      expect(group.participants.find((p) => p.userId === 'user-alice')?.conversationRole).toBe(
        ConversationRole.OWNER,
      );
    });
  });
});
