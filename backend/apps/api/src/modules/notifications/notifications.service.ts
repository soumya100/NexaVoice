import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationPriority, NotificationType } from '@nexavoice/domain-types';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  NotificationConnectionGql,
  NotificationGql,
  NotificationPreferenceGql,
  UpdateNotificationPreferenceInput,
} from './notifications.types';

export interface CreateNotificationParams {
  userId: string;
  actorId?: string;
  type: NotificationType;
  title: string;
  body: string;
  priority?: NotificationPriority;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a notification after checking user preferences.
   * Suppresses non-urgent notifications if user has global mute or category-specific muting.
   */
  async createNotification(params: CreateNotificationParams): Promise<NotificationGql | null> {
    const prefs = await this.getNotificationPreferences(params.userId);

    // Check global mute
    if (prefs.globalMute) {
      const isMuteActive = !prefs.muteUntil || new Date(prefs.muteUntil) > new Date();
      if (isMuteActive && params.priority !== NotificationPriority.URGENT) {
        return null;
      }
    }

    // Check category preferences
    if (params.type === NotificationType.MESSAGE && !prefs.messagesInApp) {
      return null;
    }
    if (
      (params.type === NotificationType.CALL_INCOMING || params.type === NotificationType.MISSED_CALL) &&
      !prefs.callsInApp
    ) {
      return null;
    }
    if (
      (params.type === NotificationType.CONTACT_REQUEST || params.type === NotificationType.CONTACT_ACCEPTED) &&
      !prefs.contactRequestsInApp
    ) {
      return null;
    }
    if (params.type === NotificationType.MENTION && !prefs.mentionsInApp) {
      return null;
    }
    if (params.type === NotificationType.AI_SUMMARY && !prefs.aiSummariesInApp) {
      return null;
    }

    const priority = params.priority || NotificationPriority.NORMAL;
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        actorId: params.actorId,
        type: params.type,
        title: params.title,
        body: params.body,
        priority,
        dataJson: params.data ? JSON.stringify(params.data) : '{}',
      },
      include: {
        actor: {
          select: {
            id: true,
            nexaVoiceId: true,
            displayName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Transactional outbox event for real-time delivery via WebSocket
    await this.prisma.outboxEvent.create({
      data: {
        eventType: 'notification.created',
        aggregateType: 'User',
        aggregateId: params.userId,
        payloadJson: JSON.stringify({
          notificationId: notification.id,
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          priority: notification.priority,
          actorId: notification.actorId,
          data: params.data || {},
          createdAt: notification.createdAt.toISOString(),
        }),
      },
    });

    return this.mapNotification(notification);
  }

  /**
   * Retrieves paginated notifications for a user.
   */
  async getUserNotifications(
    userId: string,
    limit = 20,
    offset = 0,
    unreadOnly = false,
  ): Promise<NotificationConnectionGql> {
    const where = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    if (typeof this.prisma.$queryRaw === 'function') {
      const [items, countRows] = await Promise.all([
        this.prisma.notification.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { createdAt: 'desc' },
          include: {
            actor: {
              select: {
                id: true,
                nexaVoiceId: true,
                displayName: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        }),
        unreadOnly
          ? this.prisma.$queryRaw<Array<{ totalCount: number; unreadCount: number }>>`
              SELECT 
                COUNT(*)::int as "totalCount",
                COUNT(*)::int as "unreadCount"
              FROM "Notification"
              WHERE "userId" = ${userId} AND "isRead" = false
            `
          : this.prisma.$queryRaw<Array<{ totalCount: number; unreadCount: number }>>`
              SELECT 
                COUNT(*)::int as "totalCount",
                COUNT(*) FILTER (WHERE "isRead" = false)::int as "unreadCount"
              FROM "Notification"
              WHERE "userId" = ${userId}
            `,
      ]);

      const counts = countRows[0] || { totalCount: 0, unreadCount: 0 };

      return {
        items: items.map((item) => this.mapNotification(item)),
        totalCount: Number(counts.totalCount || 0),
        unreadCount: Number(counts.unreadCount || 0),
      };
    }

    // Fallback for test harnesses where $queryRaw is unmocked
    const [items, totalCount, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              nexaVoiceId: true,
              displayName: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      items: items.map((item) => this.mapNotification(item)),
      totalCount,
      unreadCount,
    };
  }

  /**
   * Returns unread notification count.
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Marks a specific notification as read.
   */
  async markAsRead(userId: string, notificationId: string): Promise<NotificationGql> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      include: {
        actor: {
          select: {
            id: true,
            nexaVoiceId: true,
            displayName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${notificationId} not found`);
    }

    if (notification.isRead) {
      return this.mapNotification(notification);
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
      include: {
        actor: {
          select: {
            id: true,
            nexaVoiceId: true,
            displayName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return this.mapNotification(updated);
  }

  /**
   * Marks all notifications as read for a user.
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Retrieves or initializes notification preferences for a user.
   */
  async getNotificationPreferences(userId: string): Promise<NotificationPreferenceGql> {
    const prefs = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        messagesInApp: true,
        messagesEmail: false,
        callsInApp: true,
        callsEmail: true,
        contactRequestsInApp: true,
        contactRequestsEmail: false,
        mentionsInApp: true,
        mentionsEmail: true,
        aiSummariesInApp: true,
        aiSummariesEmail: false,
        globalMute: false,
      },
      update: {},
    });

    return this.mapPreferences(prefs);
  }

  /**
   * Updates notification preferences for a user.
   */
  async updateNotificationPreferences(
    userId: string,
    input: UpdateNotificationPreferenceInput,
  ): Promise<NotificationPreferenceGql> {
    const updateData: Record<string, any> = {};

    if (input.messagesInApp !== undefined) updateData.messagesInApp = input.messagesInApp;
    if (input.messagesEmail !== undefined) updateData.messagesEmail = input.messagesEmail;
    if (input.callsInApp !== undefined) updateData.callsInApp = input.callsInApp;
    if (input.callsEmail !== undefined) updateData.callsEmail = input.callsEmail;
    if (input.contactRequestsInApp !== undefined) updateData.contactRequestsInApp = input.contactRequestsInApp;
    if (input.contactRequestsEmail !== undefined) updateData.contactRequestsEmail = input.contactRequestsEmail;
    if (input.mentionsInApp !== undefined) updateData.mentionsInApp = input.mentionsInApp;
    if (input.mentionsEmail !== undefined) updateData.mentionsEmail = input.mentionsEmail;
    if (input.aiSummariesInApp !== undefined) updateData.aiSummariesInApp = input.aiSummariesInApp;
    if (input.aiSummariesEmail !== undefined) updateData.aiSummariesEmail = input.aiSummariesEmail;
    if (input.globalMute !== undefined) updateData.globalMute = input.globalMute;
    if (input.muteUntil !== undefined) {
      updateData.muteUntil = input.muteUntil ? new Date(input.muteUntil) : null;
    }

    const updated = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        messagesInApp: input.messagesInApp ?? true,
        messagesEmail: input.messagesEmail ?? false,
        callsInApp: input.callsInApp ?? true,
        callsEmail: input.callsEmail ?? true,
        contactRequestsInApp: input.contactRequestsInApp ?? true,
        contactRequestsEmail: input.contactRequestsEmail ?? false,
        mentionsInApp: input.mentionsInApp ?? true,
        mentionsEmail: input.mentionsEmail ?? true,
        aiSummariesInApp: input.aiSummariesInApp ?? true,
        aiSummariesEmail: input.aiSummariesEmail ?? false,
        globalMute: input.globalMute ?? false,
        muteUntil: input.muteUntil ? new Date(input.muteUntil) : null,
      },
      update: updateData,
    });

    return this.mapPreferences(updated);
  }

  private mapNotification(raw: any): NotificationGql {
    return {
      id: raw.id,
      userId: raw.userId,
      actorId: raw.actorId || undefined,
      actor: raw.actor
        ? {
            id: raw.actor.id,
            nexaVoiceId: raw.actor.nexaVoiceId,
            displayName: raw.actor.displayName,
            username: raw.actor.username,
            avatarUrl: raw.actor.avatarUrl || undefined,
          }
        : undefined,
      type: raw.type as NotificationType,
      title: raw.title,
      body: raw.body,
      priority: raw.priority as NotificationPriority,
      dataJson: raw.dataJson || '{}',
      isRead: raw.isRead,
      readAt: raw.readAt ? raw.readAt.toISOString() : undefined,
      createdAt: raw.createdAt.toISOString(),
    };
  }

  private mapPreferences(raw: any): NotificationPreferenceGql {
    return {
      id: raw.id,
      userId: raw.userId,
      messagesInApp: raw.messagesInApp,
      messagesEmail: raw.messagesEmail,
      callsInApp: raw.callsInApp,
      callsEmail: raw.callsEmail,
      contactRequestsInApp: raw.contactRequestsInApp,
      contactRequestsEmail: raw.contactRequestsEmail,
      mentionsInApp: raw.mentionsInApp,
      mentionsEmail: raw.mentionsEmail,
      aiSummariesInApp: raw.aiSummariesInApp,
      aiSummariesEmail: raw.aiSummariesEmail,
      globalMute: raw.globalMute,
      muteUntil: raw.muteUntil ? raw.muteUntil.toISOString() : undefined,
    };
  }
}
