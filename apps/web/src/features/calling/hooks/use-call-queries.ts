import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callKeys } from '../../../query/query-keys';
import { callApi } from '../services/call-api';
import { CallType } from '@nexavoice/domain-types';

export function useCallQuery(callId: string, enabled = true) {
  return useQuery({
    queryKey: callKeys.detail(callId),
    queryFn: () => callApi.getCall(callId),
    enabled: !!callId && enabled,
    staleTime: 5000,
  });
}

export function useActiveCallsQuery() {
  return useQuery({
    queryKey: callKeys.active(),
    queryFn: () => callApi.getActiveCalls(),
    refetchInterval: 10000,
  });
}

export function useCallHistoryQuery(limit = 20, offset = 0) {
  return useQuery({
    queryKey: callKeys.history(limit, offset),
    queryFn: () => callApi.getCallHistory(limit, offset),
  });
}

export function useCallIceServersQuery(callId: string) {
  return useQuery({
    queryKey: callKeys.iceServers(callId),
    queryFn: () => callApi.getCallIceServers(callId),
    enabled: !!callId,
    staleTime: 3600000, // 1 hour cache for ephemeral credentials
  });
}

export function useInitiateCallMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      callType: CallType;
      inviteeUserIds: string[];
      conversationId?: string;
      roomName?: string;
    }) => callApi.initiateCall(input),
    onSuccess: (data) => {
      queryClient.setQueryData(callKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: callKeys.active() });
    },
  });
}

export function useAcceptCallMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ callId, deviceId }: { callId: string; deviceId?: string }) =>
      callApi.acceptCall(callId, deviceId),
    onSuccess: (data) => {
      queryClient.setQueryData(callKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: callKeys.active() });
    },
  });
}

export function useDeclineCallMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ callId, reason }: { callId: string; reason?: string }) =>
      callApi.declineCall(callId, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: callKeys.detail(variables.callId) });
      queryClient.invalidateQueries({ queryKey: callKeys.active() });
    },
  });
}

export function useCancelCallMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (callId: string) => callApi.cancelCall(callId),
    onSuccess: (_, callId) => {
      queryClient.invalidateQueries({ queryKey: callKeys.detail(callId) });
      queryClient.invalidateQueries({ queryKey: callKeys.active() });
    },
  });
}

export function useJoinCallMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ callId, deviceId }: { callId: string; deviceId?: string }) =>
      callApi.joinCall(callId, deviceId),
    onSuccess: (data) => {
      queryClient.setQueryData(callKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: callKeys.active() });
    },
  });
}

export function useLeaveCallMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (callId: string) => callApi.leaveCall(callId),
    onSuccess: (_, callId) => {
      queryClient.invalidateQueries({ queryKey: callKeys.detail(callId) });
      queryClient.invalidateQueries({ queryKey: callKeys.active() });
    },
  });
}

export function useEndCallMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ callId, reason }: { callId: string; reason?: string }) =>
      callApi.endCall(callId, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: callKeys.detail(variables.callId) });
      queryClient.invalidateQueries({ queryKey: callKeys.active() });
      queryClient.invalidateQueries({ queryKey: callKeys.history() });
    },
  });
}

export function useMuteParticipantMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      callId: string;
      targetUserId: string;
      isAudioMuted?: boolean;
      isVideoMuted?: boolean;
    }) => callApi.muteParticipant(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: callKeys.detail(variables.callId) });
    },
  });
}

export function useRemoveParticipantMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { callId: string; targetUserId: string; reason?: string }) =>
      callApi.removeParticipant(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: callKeys.detail(variables.callId) });
    },
  });
}

export function useHoldCallMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (callId: string) => callApi.holdCall(callId),
    onSuccess: (_, callId) => {
      queryClient.invalidateQueries({ queryKey: callKeys.detail(callId) });
    },
  });
}

export function useResumeCallMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (callId: string) => callApi.resumeCall(callId),
    onSuccess: (_, callId) => {
      queryClient.invalidateQueries({ queryKey: callKeys.detail(callId) });
    },
  });
}
