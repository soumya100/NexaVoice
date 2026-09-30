import { NotFoundException } from '@nestjs/common';
import { NotificationPriority, NotificationType } from '@nexavoice/domain-types';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockPrisma: any;

  const mockUser = {
    id: 'user-1',
    nexaVoiceId: 'NV-ALICE1',
    displayName: 'Alice User',
    username: 'alice',
    avatarUrl: 'https://example.com/alice.png',
  };

  const defaultPreferences = {
    id: 'pref-1',
    userId: 'user-1',
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
    muteUntil: null,
  };

  beforeEach(() => {
    mockPrisma = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      notificationPreference: {
        upsert: jest.fn().mockResolvedValue(defaultPreferences),
        findUnique: jest.fn(),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
      },
    };

    service = new NotificationsService(mockPrisma);
  });

  describe('createNotification', () => {
    it('creates notification and outbox event when preferences allow', async () => {
      const createdNotification = {
        id: 'notif-1',
        userId: 'user-1',
        actorId: 'actor-1',
        actor: mockUser,
        type: NotificationType.MESSAGE,
        title: 'New message',
        body: 'Hello there',
        priority: NotificationPriority.NORMAL,
        dataJson: '{"conversationId":"conv-1"}',
        isRead: false,
        readAt: null,
        createdAt: new Date('2026-09-30T10:00:00Z'),
      };

      mockPrisma.notification.create.mockResolvedValue(createdNotification);

      const result = await service.createNotification({
        userId: 'user-1',
        actorId: 'actor-1',
        type: NotificationType.MESSAGE,
        title: 'New message',
        body: 'Hello there',
        data: { conversationId: 'conv-1' },
      });

      expect(result).toBeDefined();
      expect(result?.id).toBe('notif-1');
      expect(mockPrisma.notification.create).toHaveBeenCalled();
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'notification.created',
          aggregateType: 'User',
          aggregateId: 'user-1',
        }),
      });
    });

    it('suppresses normal notifications when global mute is active', async () => {
      mockPrisma.notificationPreference.upsert.mockResolvedValue({
        ...defaultPreferences,
        globalMute: true,
        muteUntil: new Date('2027-01-01T00:00:00Z'),
      });

      const result = await service.createNotification({
        userId: 'user-1',
        type: NotificationType.MESSAGE,
        title: 'New message',
        body: 'Muted message',
        priority: NotificationPriority.NORMAL,
      });

      expect(result).toBeNull();
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('allows urgent notifications even when global mute is active', async () => {
      mockPrisma.notificationPreference.upsert.mockResolvedValue({
        ...defaultPreferences,
        globalMute: true,
        muteUntil: new Date('2027-01-01T00:00:00Z'),
      });

      const urgentNotif = {
        id: 'notif-urgent',
        userId: 'user-1',
        actorId: null,
        actor: null,
        type: NotificationType.CALL_INCOMING,
        title: 'Emergency Call',
        body: 'Call incoming',
        priority: NotificationPriority.URGENT,
        dataJson: '{}',
        isRead: false,
        readAt: null,
        createdAt: new Date('2026-09-30T10:00:00Z'),
      };

      mockPrisma.notification.create.mockResolvedValue(urgentNotif);

      const result = await service.createNotification({
        userId: 'user-1',
        type: NotificationType.CALL_INCOMING,
        title: 'Emergency Call',
        body: 'Call incoming',
        priority: NotificationPriority.URGENT,
      });

      expect(result).toBeDefined();
      expect(result?.priority).toBe(NotificationPriority.URGENT);
      expect(mockPrisma.notification.create).toHaveBeenCalled();
    });

    it('suppresses message notifications when messagesInApp is disabled', async () => {
      mockPrisma.notificationPreference.upsert.mockResolvedValue({
        ...defaultPreferences,
        messagesInApp: false,
      });

      const result = await service.createNotification({
        userId: 'user-1',
        type: NotificationType.MESSAGE,
        title: 'Chat message',
        body: 'Should be suppressed',
      });

      expect(result).toBeNull();
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('suppresses call notifications when callsInApp is disabled', async () => {
      mockPrisma.notificationPreference.upsert.mockResolvedValue({
        ...defaultPreferences,
        callsInApp: false,
      });

      const result = await service.createNotification({
        userId: 'user-1',
        type: NotificationType.MISSED_CALL,
        title: 'Missed Call',
        body: 'You missed a call',
      });

      expect(result).toBeNull();
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('getUserNotifications', () => {
    it('returns paginated notifications and counts', async () => {
      const mockItems = [
        {
          id: 'notif-1',
          userId: 'user-1',
          actorId: 'user-2',
          actor: mockUser,
          type: NotificationType.CONTACT_REQUEST,
          title: 'Contact Request',
          body: 'Alice sent a request',
          priority: NotificationPriority.NORMAL,
          dataJson: '{}',
          isRead: false,
          readAt: null,
          createdAt: new Date('2026-09-30T10:00:00Z'),
        },
      ];

      mockPrisma.notification.findMany.mockResolvedValue(mockItems);
      mockPrisma.notification.count
        .mockResolvedValueOnce(10) // totalCount
        .mockResolvedValueOnce(3); // unreadCount

      const result = await service.getUserNotifications('user-1', 10, 0, false);

      expect(result.items).toHaveLength(1);
      expect(result.totalCount).toBe(10);
      expect(result.unreadCount).toBe(3);
      expect(result.items[0].id).toBe('notif-1');
    });
  });

  describe('markAsRead', () => {
    it('marks notification as read', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        isRead: false,
        readAt: null,
        type: NotificationType.MESSAGE,
        title: 'Msg',
        body: 'Txt',
        priority: NotificationPriority.NORMAL,
        dataJson: '{}',
        createdAt: new Date(),
        actor: null,
      });

      mockPrisma.notification.update.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        isRead: true,
        readAt: new Date('2026-09-30T11:00:00Z'),
        type: NotificationType.MESSAGE,
        title: 'Msg',
        body: 'Txt',
        priority: NotificationPriority.NORMAL,
        dataJson: '{}',
        createdAt: new Date(),
        actor: null,
      });

      const result = await service.markAsRead('user-1', 'notif-1');

      expect(result.isRead).toBe(true);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'notif-1' },
          data: expect.objectContaining({ isRead: true }),
        }),
      );
    });

    it('throws NotFoundException if notification does not exist', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead('user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAllAsRead', () => {
    it('marks all unread notifications as read and returns count', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const count = await service.markAllAsRead('user-1');

      expect(count).toBe(5);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: expect.objectContaining({ isRead: true }),
      });
    });
  });

  describe('notification preferences', () => {
    it('retrieves preferences', async () => {
      const prefs = await service.getNotificationPreferences('user-1');
      expect(prefs.userId).toBe('user-1');
      expect(prefs.messagesInApp).toBe(true);
    });

    it('updates preferences', async () => {
      mockPrisma.notificationPreference.upsert.mockResolvedValue({
        ...defaultPreferences,
        messagesInApp: false,
        globalMute: true,
      });

      const updated = await service.updateNotificationPreferences('user-1', {
        messagesInApp: false,
        globalMute: true,
      });

      expect(updated.messagesInApp).toBe(false);
      expect(updated.globalMute).toBe(true);
    });
  });
});
