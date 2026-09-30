import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationKeys } from '../../../query/query-keys';
import {
  executeGraphQL,
  GET_NOTIFICATIONS_QUERY,
  GET_UNREAD_NOTIFICATION_COUNT_QUERY,
  MARK_NOTIFICATION_READ_MUTATION,
  MARK_ALL_NOTIFICATIONS_READ_MUTATION,
  GET_NOTIFICATION_PREFERENCES_QUERY,
  UPDATE_NOTIFICATION_PREFERENCES_MUTATION,
} from '../../../services/api';
import { realtimeClient } from '../../../services/realtime';
import { toastService } from '../../../services/toast';

export interface NotificationItem {
  id: string;
  userId: string;
  actorId?: string;
  actor?: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl?: string;
  };
  type: string;
  title: string;
  body: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dataJson?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationConnection {
  totalCount: number;
  unreadCount: number;
  items: NotificationItem[];
}

export interface NotificationPreference {
  id: string;
  userId: string;
  messagesInApp: boolean;
  messagesEmail: boolean;
  callsInApp: boolean;
  callsEmail: boolean;
  contactRequestsInApp: boolean;
  contactRequestsEmail: boolean;
  mentionsInApp: boolean;
  mentionsEmail: boolean;
  aiSummariesInApp: boolean;
  aiSummariesEmail: boolean;
  globalMute: boolean;
  muteUntil?: string;
}

export function useNotifications(filters: { limit?: number; offset?: number; unreadOnly?: boolean } = {}) {
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery<NotificationConnection>({
    queryKey: notificationKeys.list(filters),
    queryFn: async () => {
      const res = await executeGraphQL<{ notifications: NotificationConnection }>(
        GET_NOTIFICATIONS_QUERY,
        filters,
      );
      return res.notifications;
    },
    staleTime: 15000,
  });

  const unreadCountQuery = useQuery<number>({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const res = await executeGraphQL<{ unreadNotificationCount: number }>(
        GET_UNREAD_NOTIFICATION_COUNT_QUERY,
      );
      return res.unreadNotificationCount;
    },
    staleTime: 15000,
  });

  const preferencesQuery = useQuery<NotificationPreference>({
    queryKey: notificationKeys.preferences(),
    queryFn: async () => {
      const res = await executeGraphQL<{ notificationPreferences: NotificationPreference }>(
        GET_NOTIFICATION_PREFERENCES_QUERY,
      );
      return res.notificationPreferences;
    },
    staleTime: 60000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await executeGraphQL(MARK_NOTIFICATION_READ_MUTATION, { id });
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueriesData<NotificationConnection>(
        { queryKey: notificationKeys.all },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            unreadCount: Math.max(0, old.unreadCount - 1),
            items: old.items.map((item) =>
              item.id === id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item,
            ),
          };
        },
      );
      queryClient.setQueryData<number>(notificationKeys.unreadCount(), (old = 1) =>
        Math.max(0, old - 1),
      );
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await executeGraphQL<{ markAllNotificationsAsRead: number }>(
        MARK_ALL_NOTIFICATIONS_READ_MUTATION,
      );
      return res.markAllNotificationsAsRead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      queryClient.setQueryData(notificationKeys.unreadCount(), 0);
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (input: Partial<NotificationPreference>) => {
      const res = await executeGraphQL<{ updateNotificationPreferences: NotificationPreference }>(
        UPDATE_NOTIFICATION_PREFERENCES_MUTATION,
        { input },
      );
      return res.updateNotificationPreferences;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(notificationKeys.preferences(), updated);
      toastService.success('Notification preferences updated');
    },
  });

  // Listen for real-time notification events
  useEffect(() => {
    const unsub = realtimeClient.onNotificationCreated((payload: any) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      queryClient.setQueryData<number>(notificationKeys.unreadCount(), (old = 0) => old + 1);

      if (payload?.title) {
        toastService.info(`${payload.title}: ${payload.body || ''}`);
      }
    });

    return () => unsub();
  }, [queryClient]);

  return {
    notifications: notificationsQuery.data?.items ?? [],
    totalCount: notificationsQuery.data?.totalCount ?? 0,
    unreadCount: unreadCountQuery.data ?? notificationsQuery.data?.unreadCount ?? 0,
    preferences: preferencesQuery.data,
    isLoading: notificationsQuery.isLoading,
    markAsRead: (id: string) => markReadMutation.mutateAsync(id),
    markAllAsRead: () => markAllReadMutation.mutateAsync(),
    updatePreferences: (input: Partial<NotificationPreference>) =>
      updatePreferencesMutation.mutateAsync(input),
  };
}
