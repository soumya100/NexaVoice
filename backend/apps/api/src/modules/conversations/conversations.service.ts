import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConversationRole,
  ConversationType,
  PrivacyLevel,
} from '@nexavoice/domain-types';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { ContactsService } from '../contacts/contacts.service';
import {
  AddParticipantInput,
  ConversationGql,
  CreateDirectConversationInput,
  CreateGroupConversationInput,
  UpdateConversationInput,
} from './conversations.types';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
    private readonly contactsService: ContactsService,
  ) {}

  /**
   * Sorts two user IDs lexicographically for deterministic direct conversation pairing.
   */
  private sortDirectPair(userA: string, userB: string): [string, string] {
    return userA < userB ? [userA, userB] : [userB, userA];
  }

  /**
   * Finds or creates a direct conversation between two users deterministically.
   * Guarantees that concurrent requests never create duplicate conversations.
   */
  async getOrCreateDirectConversation(
    userId: string,
    input: CreateDirectConversationInput,
  ): Promise<ConversationGql> {
    const rawTarget = input.targetUserId.trim();

    // Resolve target user if an ID or username was passed
    const targetUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: rawTarget },
          { nexaVoiceId: rawTarget },
          { username: { equals: rawTarget, mode: 'insensitive' } },
        ],
      },
      include: { privacySettings: true },
    });

    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    if (targetUser.id === userId) {
      throw new BadRequestException('Cannot start a direct conversation with yourself');
    }

    // Check blocking in both directions
    const isBlocked = await this.contactsService.isBlocked(userId, targetUser.id);
    if (isBlocked) {
      throw new ForbiddenException('Cannot start a conversation with this user');
    }

    // Check privacy settings
    if (targetUser.privacySettings?.whoCanMessageMe === PrivacyLevel.NOBODY) {
      throw new ForbiddenException('This user does not accept direct messages');
    }

    const [u1, u2] = this.sortDirectPair(userId, targetUser.id);

    // Check if direct conversation already exists
    const existing = await this.prisma.conversation.findUnique({
      where: {
        directUserAId_directUserBId: {
          directUserAId: u1,
          directUserBId: u2,
        },
      },
      include: {
        participants: {
          include: { user: true },
        },
      },
    });

    if (existing) {
      return this.mapConversation(existing, userId);
    }

    // Transactionally create direct conversation
    try {
      const created = await this.prisma.conversation.create({
        data: {
          type: ConversationType.DIRECT,
          directUserAId: u1,
          directUserBId: u2,
          creatorId: userId,
          participants: {
            create: [
              { userId: u1, conversationRole: ConversationRole.MEMBER },
              { userId: u2, conversationRole: ConversationRole.MEMBER },
            ],
          },
        },
        include: {
          participants: {
            include: { user: true },
          },
        },
      });

      await this.securityAudit.logEvent({
        actorId: userId,
        action: 'CONVERSATION_DIRECT_CREATED',
        targetType: 'Conversation',
        targetId: created.id,
        result: 'SUCCESS',
      });

      return this.mapConversation(created, userId);
    } catch (err: unknown) {
      // Handle concurrent race: if unique constraint violated, return the created one
      const retry = await this.prisma.conversation.findUnique({
        where: {
          directUserAId_directUserBId: {
            directUserAId: u1,
            directUserBId: u2,
          },
        },
        include: {
          participants: {
            include: { user: true },
          },
        },
      });

      if (retry) {
        return this.mapConversation(retry, userId);
      }
      throw err;
    }
  }

  /**
   * Creates a group conversation.
   */
  async createGroupConversation(
    creatorId: string,
    input: CreateGroupConversationInput,
  ): Promise<ConversationGql> {
    const title = input.title.trim();
    if (!title) {
      throw new BadRequestException('Group title cannot be blank');
    }

    // Filter valid participants
    const candidateIds = Array.from(new Set(input.participantUserIds)).filter(
      (id) => id !== creatorId,
    );

    const validParticipants: string[] = [creatorId];

    for (const targetId of candidateIds) {
      const blocked = await this.contactsService.isBlocked(creatorId, targetId);
      if (blocked) continue;

      const targetUser = await this.prisma.user.findUnique({
        where: { id: targetId },
        include: { privacySettings: true },
      });

      if (targetUser && targetUser.privacySettings?.whoCanAddMeToGroups !== PrivacyLevel.NOBODY) {
        validParticipants.push(targetId);
      }
    }

    const created = await this.prisma.conversation.create({
      data: {
        type: ConversationType.GROUP,
        title,
        description: input.description,
        avatarUrl: input.avatarUrl,
        creatorId,
        participants: {
          create: validParticipants.map((uid) => ({
            userId: uid,
            conversationRole: uid === creatorId ? ConversationRole.OWNER : ConversationRole.MEMBER,
          })),
        },
      },
      include: {
        participants: {
          include: { user: true },
        },
      },
    });

    await this.securityAudit.logEvent({
      actorId: creatorId,
      action: 'CONVERSATION_GROUP_CREATED',
      targetType: 'Conversation',
      targetId: created.id,
      result: 'SUCCESS',
      metadata: { participantCount: validParticipants.length },
    });

    return this.mapConversation(created, creatorId);
  }

  /**
   * Lists all active conversations for the authenticated user.
   */
  async getUserConversations(userId: string): Promise<ConversationGql[]> {
    const userMemberships = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });

    const conversationIds = userMemberships.map((m) => m.conversationId);

    const conversations = await this.prisma.conversation.findMany({
      where: {
        id: { in: conversationIds },
      },
      include: {
        participants: {
          include: { user: true },
        },
        messages: {
          where: { deletedAt: null },
          orderBy: { sequenceNumber: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations.map((conv) => {
      const latestMsg = conv.messages[0];
      return this.mapConversation(conv, userId, latestMsg?.content);
    });
  }

  /**
   * Retrieves a single conversation by ID with access authorization check.
   */
  async getConversationById(userId: string, conversationId: string): Promise<ConversationGql> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: { user: true },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isMember = conversation.participants.some((p) => p.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    return this.mapConversation(conversation, userId);
  }

  /**
   * Adds a participant to a group conversation.
   */
  async addParticipant(userId: string, input: AddParticipantInput): Promise<ConversationGql> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: input.conversationId },
      include: { participants: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Participants can only be added to group conversations');
    }

    // Check caller permission: must be OWNER or ADMIN in the conversation
    const callerParticipant = conversation.participants.find((p) => p.userId === userId);
    if (
      !callerParticipant ||
      (callerParticipant.conversationRole !== ConversationRole.OWNER &&
        callerParticipant.conversationRole !== ConversationRole.ADMIN)
    ) {
      throw new ForbiddenException('Only conversation owners or admins can add participants');
    }

    // Check if target is already participant
    const alreadyMember = conversation.participants.some((p) => p.userId === input.userId);
    if (alreadyMember) {
      return this.getConversationById(userId, input.conversationId);
    }

    // Check blocking & privacy
    const isBlocked = await this.contactsService.isBlocked(userId, input.userId);
    if (isBlocked) {
      throw new ForbiddenException('Unable to add this user to the group');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: input.userId },
      include: { privacySettings: true },
    });

    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    if (targetUser.privacySettings?.whoCanAddMeToGroups === PrivacyLevel.NOBODY) {
      throw new ForbiddenException('This user does not accept group invitations');
    }

    await this.prisma.conversationParticipant.create({
      data: {
        conversationId: input.conversationId,
        userId: input.userId,
        conversationRole: input.role || ConversationRole.MEMBER,
      },
    });

    await this.securityAudit.logEvent({
      actorId: userId,
      action: 'CONVERSATION_PARTICIPANT_ADDED',
      targetType: 'Conversation',
      targetId: input.conversationId,
      result: 'SUCCESS',
      metadata: { addedUserId: input.userId },
    });

    return this.getConversationById(userId, input.conversationId);
  }

  /**
   * Removes a participant from a group conversation.
   */
  async removeParticipant(
    callerId: string,
    input: { conversationId: string; userId: string },
  ): Promise<boolean> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: input.conversationId },
      include: { participants: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const caller = conversation.participants.find((p) => p.userId === callerId);
    const target = conversation.participants.find((p) => p.userId === input.userId);

    if (!caller || !target) {
      throw new NotFoundException('Participant not found in conversation');
    }

    // Self-removal (leaving) is always permitted
    if (callerId !== input.userId) {
      if (caller.conversationRole !== ConversationRole.OWNER && caller.conversationRole !== ConversationRole.ADMIN) {
        throw new ForbiddenException('Only owners and admins can remove other participants');
      }
      if (target.conversationRole === ConversationRole.OWNER) {
        throw new ForbiddenException('Group owner cannot be removed');
      }
    }

    await this.prisma.conversationParticipant.delete({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId: input.userId,
        },
      },
    });

    // If owner leaves, reassign owner role to oldest admin or member
    if (target.conversationRole === ConversationRole.OWNER) {
      const remaining = await this.prisma.conversationParticipant.findFirst({
        where: { conversationId: input.conversationId },
        orderBy: [{ conversationRole: 'asc' }, { joinedAt: 'asc' }],
      });

      if (remaining) {
        await this.prisma.conversationParticipant.update({
          where: { id: remaining.id },
          data: { conversationRole: ConversationRole.OWNER },
        });
      }
    }

    await this.securityAudit.logEvent({
      actorId: callerId,
      action: 'CONVERSATION_PARTICIPANT_REMOVED',
      targetType: 'Conversation',
      targetId: input.conversationId,
      result: 'SUCCESS',
      metadata: { removedUserId: input.userId },
    });

    return true;
  }

  /**
   * Updates conversation metadata or user mute status.
   */
  async updateConversation(
    userId: string,
    input: UpdateConversationInput,
  ): Promise<ConversationGql> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: input.conversationId },
      include: { participants: true },
    });

    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }

    const participant = conv.participants.find((p) => p.userId === userId);
    if (!participant) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    // Update conversation metadata if owner or admin
    if (input.title !== undefined || input.description !== undefined || input.avatarUrl !== undefined) {
      if (
        conv.type === ConversationType.GROUP &&
        participant.conversationRole !== ConversationRole.OWNER &&
        participant.conversationRole !== ConversationRole.ADMIN
      ) {
        throw new ForbiddenException('Only owners or admins can update group details');
      }

      await this.prisma.conversation.update({
        where: { id: input.conversationId },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
        },
      });
    }

    // Update user-specific mute setting
    if (input.isMuted !== undefined) {
      await this.prisma.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId,
          },
        },
        data: { isMuted: input.isMuted },
      });
    }

    return this.getConversationById(userId, input.conversationId);
  }

  /**
   * Maps Prisma conversation entity to GraphQL response object.
   */
  private mapConversation(
    conversation: any,
    currentUserId: string,
    latestSnippet?: string,
  ): ConversationGql {
    let title = conversation.title;
    let avatarUrl = conversation.avatarUrl;

    // For direct conversations, dynamic title is other user's display name
    if (conversation.type === ConversationType.DIRECT) {
      const otherParticipant = conversation.participants.find(
        (p: any) => p.userId !== currentUserId,
      );
      if (otherParticipant?.user) {
        title = otherParticipant.user.displayName || otherParticipant.user.username;
        avatarUrl = otherParticipant.user.avatarUrl;
      }
    }

    // Calculate unread count
    const myParticipant = conversation.participants.find(
      (p: any) => p.userId === currentUserId,
    );
    const unreadCount =
      myParticipant && conversation.currentSequence > 0
        ? Math.max(0, conversation.currentSequence - (myParticipant.lastReadSequence || 0))
        : 0;

    return {
      id: conversation.id,
      type: conversation.type as ConversationType,
      title: title || 'Conversation',
      description: conversation.description || undefined,
      avatarUrl: avatarUrl || undefined,
      creatorId: conversation.creatorId || undefined,
      currentSequence: conversation.currentSequence,
      lastMessageAt: conversation.lastMessageAt?.toISOString(),
      lastMessageSnippet: latestSnippet,
      unreadCount,
      participants: conversation.participants.map((p: any) => ({
        id: p.id,
        conversationId: p.conversationId,
        userId: p.userId,
        conversationRole: p.conversationRole as ConversationRole,
        joinedAt: p.joinedAt.toISOString(),
        lastDeliveredMessageId: p.lastDeliveredMessageId || undefined,
        lastReadMessageId: p.lastReadMessageId || undefined,
        lastReadAt: p.lastReadAt?.toISOString(),
        isMuted: p.isMuted,
        user: {
          id: p.user.id,
          nexaVoiceId: p.user.nexaVoiceId,
          username: p.user.username,
          displayName: p.user.displayName,
          avatarUrl: p.user.avatarUrl || undefined,
        },
      })),
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }
}
