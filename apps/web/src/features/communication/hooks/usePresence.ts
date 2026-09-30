import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { presenceKeys } from '../../../query/query-keys';
import {
  executeGraphQL,
  GET_MY_PRESENCE_QUERY,
  GET_USER_PRESENCE_QUERY,
  UPDATE_PRESENCE_MUTATION,
} from '../../../services/api';
import { realtimeClient } from '../../../services/realtime';

export type PresenceStatus = 'ONLINE' | 'BUSY' | 'AWAY' | 'OFFLINE';
export type UserAvailability = 'AVAILABLE' | 'BUSY' | 'IN_CALL' | 'DO_NOT_DISTURB' | 'UNAVAILABLE';

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  customStatus?: string;
  availability: UserAvailability;
  lastSeenAt: string;
}

export function useMyPresence() {
  const queryClient = useQueryClient();

  const query = useQuery<UserPresence>({
    queryKey: presenceKeys.me(),
    queryFn: async () => {
      const res = await executeGraphQL<{ myPresence: UserPresence }>(GET_MY_PRESENCE_QUERY);
      return res.myPresence;
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  const updateMutation = useMutation({
    mutationFn: async (input: { status?: PresenceStatus; customStatus?: string }) => {
      const res = await executeGraphQL<{ updatePresence: UserPresence }>(UPDATE_PRESENCE_MUTATION, {
        input,
      });
      // Also emit via socket for immediate low-latency broadcast
      if (input.status) {
        realtimeClient.sendPresenceUpdate(input.status, input.customStatus);
      }
      return res.updatePresence;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(presenceKeys.me(), data);
    },
  });

  // Heartbeat loop: send every 30 seconds to maintain ephemeral Redis key
  useEffect(() => {
    const interval = setInterval(() => {
      if (query.data) {
        realtimeClient.sendPresenceHeartbeat(query.data.status, query.data.customStatus);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [query.data]);

  // Real-time listener for incoming presence broadcasts
  useEffect(() => {
    const unsub = realtimeClient.onPresenceUpdated((payload: UserPresence) => {
      if (payload?.userId) {
        queryClient.setQueryData(presenceKeys.user(payload.userId), payload);
        if (query.data && payload.userId === query.data.userId) {
          queryClient.setQueryData(presenceKeys.me(), payload);
        }
      }
    });

    return () => unsub();
  }, [queryClient, query.data]);

  return {
    presence: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    updateStatus: (status: PresenceStatus, customStatus?: string) =>
      updateMutation.mutateAsync({ status, customStatus }),
    isUpdating: updateMutation.isPending,
  };
}

export function useUserPresence(userId?: string) {
  return useQuery<UserPresence | null>({
    queryKey: presenceKeys.user(userId || ''),
    queryFn: async () => {
      if (!userId) return null;
      const res = await executeGraphQL<{ userPresence: UserPresence }>(GET_USER_PRESENCE_QUERY, {
        userId,
      });
      return res.userPresence;
    },
    enabled: !!userId,
    staleTime: 20000,
  });
}
