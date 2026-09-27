import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface MessageSearchOptions {
  conversationId?: string;
  limit?: number;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search messages across conversations accessible to the user.
   */
  async searchMessages(
    userId: string,
    query: string,
    options?: MessageSearchOptions,
  ): Promise<any[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length < 2) {
      return [];
    }

    // Determine conversations user can access
    const userMemberships = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    const accessibleConversationIds = userMemberships.map((m) => m.conversationId);

    if (accessibleConversationIds.length === 0) {
      return [];
    }

    const conversationFilter = options?.conversationId
      ? accessibleConversationIds.includes(options.conversationId)
        ? [options.conversationId]
        : []
      : accessibleConversationIds;

    if (conversationFilter.length === 0) {
      return [];
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: { in: conversationFilter },
        deletedAt: null,
        content: { contains: cleanQuery, mode: 'insensitive' },
      },
      include: {
        sender: true,
        reactions: { include: { user: true } },
        attachments: true,
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 20,
    });

    return messages;
  }
}
