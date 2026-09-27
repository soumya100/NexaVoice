import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConversationRole, ConversationType } from '@nexavoice/domain-types';
import { ConversationsService } from './conversations.service';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let mockPrisma: any;
  let mockSecurityAudit: any;
  let mockContactsService: any;
  let mockSignalingGateway: any;

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
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockSignalingGateway = {
      evictUserFromConversation: jest.fn(),
      broadcastToConversation: jest.fn(),
    };

    service = new ConversationsService(
      mockPrisma,
      mockSecurityAudit,
      mockContactsService,
      mockSignalingGateway,
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

  describe('removeParticipant - Role-Based Moderation & Socket Room Eviction', () => {
    it('1. MEMBER attempts to remove MEMBER -> DENIED (ForbiddenException)', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'group-100',
        participants: [
          { userId: 'member-1', conversationRole: ConversationRole.MEMBER },
          { userId: 'member-2', conversationRole: ConversationRole.MEMBER },
        ],
      });

      await expect(
        service.removeParticipant('member-1', {
          conversationId: 'group-100',
          userId: 'member-2',
        }),
      ).rejects.toThrow('Only owners and admins can remove other participants');
    });

    it('2. ADMIN removes MEMBER -> ALLOWED, triggers socket room eviction & event broadcast', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'group-100',
        participants: [
          { userId: 'admin-1', conversationRole: ConversationRole.ADMIN },
          { userId: 'member-bad', conversationRole: ConversationRole.MEMBER },
        ],
      });
      mockPrisma.conversationParticipant.delete.mockResolvedValue({});

      const result = await service.removeParticipant('admin-1', {
        conversationId: 'group-100',
        userId: 'member-bad',
      });

      expect(result).toBe(true);
      expect(mockPrisma.conversationParticipant.delete).toHaveBeenCalledWith({
        where: {
          conversationId_userId: {
            conversationId: 'group-100',
            userId: 'member-bad',
          },
        },
      });

      // Verify immediate socket eviction and room broadcast
      expect(mockSignalingGateway.evictUserFromConversation).toHaveBeenCalledWith(
        'member-bad',
        'group-100',
      );
      expect(mockSignalingGateway.broadcastToConversation).toHaveBeenCalledWith(
        'group-100',
        'conversation.participant.removed',
        expect.objectContaining({
          conversationId: 'group-100',
          removedUserId: 'member-bad',
        }),
      );
    });

    it('3. OWNER removes ADMIN -> ALLOWED', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'group-100',
        participants: [
          { userId: 'owner-1', conversationRole: ConversationRole.OWNER },
          { userId: 'admin-1', conversationRole: ConversationRole.ADMIN },
        ],
      });
      mockPrisma.conversationParticipant.delete.mockResolvedValue({});

      const result = await service.removeParticipant('owner-1', {
        conversationId: 'group-100',
        userId: 'admin-1',
      });

      expect(result).toBe(true);
      expect(mockSignalingGateway.evictUserFromConversation).toHaveBeenCalledWith('admin-1', 'group-100');
    });

    it('4. ADMIN attempts to remove OWNER -> DENIED', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'group-100',
        participants: [
          { userId: 'admin-1', conversationRole: ConversationRole.ADMIN },
          { userId: 'owner-1', conversationRole: ConversationRole.OWNER },
        ],
      });

      await expect(
        service.removeParticipant('admin-1', {
          conversationId: 'group-100',
          userId: 'owner-1',
        }),
      ).rejects.toThrow('Group owner cannot be removed');
    });

    it('5. OWNER leaves group -> triggers owner role transfer to remaining participant', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'group-100',
        participants: [
          { userId: 'owner-1', conversationRole: ConversationRole.OWNER },
          { userId: 'admin-successor', conversationRole: ConversationRole.ADMIN },
        ],
      });
      mockPrisma.conversationParticipant.delete.mockResolvedValue({});
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: 'cp-successor',
        userId: 'admin-successor',
        conversationRole: ConversationRole.ADMIN,
      });

      const result = await service.removeParticipant('owner-1', {
        conversationId: 'group-100',
        userId: 'owner-1',
      });

      expect(result).toBe(true);
      expect(mockPrisma.conversationParticipant.update).toHaveBeenCalledWith({
        where: { id: 'cp-successor' },
        data: { conversationRole: ConversationRole.OWNER },
      });
    });
  });
});
