import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callApi } from '../services/call-api';
import { callKeys, conferenceKeys, recordingKeys, scheduleKeys } from '../../../query/query-keys';
import { RecordingType } from '@nexavoice/domain-types';

export function useAdvancedCalling(callId?: string) {
  const queryClient = useQueryClient();

  // Queries
  const recordingsQuery = useQuery({
    queryKey: recordingKeys.forCall(callId || ''),
    queryFn: () => callApi.getCallRecordings(callId!),
    enabled: Boolean(callId),
  });

  const scheduledCallsQuery = useQuery({
    queryKey: scheduleKeys.list(),
    queryFn: () => callApi.getScheduledCalls(),
  });

  // Call Swap Mutation
  const swapCallsMutation = useMutation({
    mutationFn: ({ holdCallId, resumeCallId }: { holdCallId: string; resumeCallId: string }) =>
      callApi.swapCalls(holdCallId, resumeCallId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: callKeys.active() });
      if (callId) queryClient.invalidateQueries({ queryKey: callKeys.detail(callId) });
    },
  });

  // Blind Transfer Mutation
  const blindTransferMutation = useMutation({
    mutationFn: ({ callId: cId, targetUserId }: { callId: string; targetUserId: string }) =>
      callApi.blindTransfer(cId, targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: callKeys.all });
    },
  });

  // Attended Transfer Mutations
  const initiateAttendedTransferMutation = useMutation({
    mutationFn: ({ originalCallId, targetUserId }: { originalCallId: string; targetUserId: string }) =>
      callApi.initiateAttendedTransfer(originalCallId, targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: callKeys.active() });
    },
  });

  const completeAttendedTransferMutation = useMutation({
    mutationFn: (transferCallId: string) => callApi.completeAttendedTransfer(transferCallId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: callKeys.all });
    },
  });

  // Call Merge Mutation
  const mergeCallsMutation = useMutation({
    mutationFn: ({ callIdA, callIdB }: { callIdA: string; callIdB: string }) =>
      callApi.mergeCalls(callIdA, callIdB),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: callKeys.all });
      queryClient.invalidateQueries({ queryKey: conferenceKeys.all });
    },
  });

  // Split Conference Call Mutation
  const splitConferenceCallMutation = useMutation({
    mutationFn: ({ conferenceId, participantUserId }: { conferenceId: string; participantUserId: string }) =>
      callApi.splitConferenceCall(conferenceId, participantUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: callKeys.all });
      queryClient.invalidateQueries({ queryKey: conferenceKeys.all });
    },
  });

  // Waiting Room Mutations
  const admitParticipantMutation = useMutation({
    mutationFn: ({ callId: cId, targetUserId }: { callId: string; targetUserId: string }) =>
      callApi.admitParticipant(cId, targetUserId),
    onSuccess: () => {
      if (callId) queryClient.invalidateQueries({ queryKey: callKeys.detail(callId) });
    },
  });

  const denyParticipantMutation = useMutation({
    mutationFn: ({ callId: cId, targetUserId }: { callId: string; targetUserId: string }) =>
      callApi.denyParticipant(cId, targetUserId),
    onSuccess: () => {
      if (callId) queryClient.invalidateQueries({ queryKey: callKeys.detail(callId) });
    },
  });

  // Device Handoff Mutations
  const initiateDeviceTransferMutation = useMutation({
    mutationFn: ({ callId: cId, targetDeviceId }: { callId: string; targetDeviceId: string }) =>
      callApi.initiateDeviceTransfer(cId, targetDeviceId),
  });

  const completeDeviceTransferMutation = useMutation({
    mutationFn: ({
      callId: cId,
      transferId,
      sourceDeviceId,
      targetDeviceId,
    }: {
      callId: string;
      transferId: string;
      sourceDeviceId: string;
      targetDeviceId: string;
    }) => callApi.completeDeviceTransfer(cId, transferId, sourceDeviceId, targetDeviceId),
    onSuccess: () => {
      if (callId) queryClient.invalidateQueries({ queryKey: callKeys.detail(callId) });
    },
  });

  // Recording Mutations
  const startRecordingMutation = useMutation({
    mutationFn: ({ callId: cId, recordingType }: { callId: string; recordingType?: RecordingType }) =>
      callApi.startRecording(cId, recordingType),
    onSuccess: () => {
      if (callId) queryClient.invalidateQueries({ queryKey: recordingKeys.forCall(callId) });
    },
  });

  const pauseRecordingMutation = useMutation({
    mutationFn: ({ callId: cId, recordingId }: { callId: string; recordingId: string }) =>
      callApi.pauseRecording(cId, recordingId),
    onSuccess: () => {
      if (callId) queryClient.invalidateQueries({ queryKey: recordingKeys.forCall(callId) });
    },
  });

  const resumeRecordingMutation = useMutation({
    mutationFn: ({ callId: cId, recordingId }: { callId: string; recordingId: string }) =>
      callApi.resumeRecording(cId, recordingId),
    onSuccess: () => {
      if (callId) queryClient.invalidateQueries({ queryKey: recordingKeys.forCall(callId) });
    },
  });

  const stopRecordingMutation = useMutation({
    mutationFn: ({ callId: cId, recordingId }: { callId: string; recordingId: string }) =>
      callApi.stopRecording(cId, recordingId),
    onSuccess: () => {
      if (callId) queryClient.invalidateQueries({ queryKey: recordingKeys.forCall(callId) });
    },
  });

  const submitRecordingConsentMutation = useMutation({
    mutationFn: ({
      callId: cId,
      recordingId,
      consented,
    }: {
      callId: string;
      recordingId: string;
      consented: boolean;
    }) => callApi.submitRecordingConsent(cId, recordingId, consented),
    onSuccess: () => {
      if (callId) queryClient.invalidateQueries({ queryKey: recordingKeys.forCall(callId) });
    },
  });

  // Schedule Call Mutations
  const scheduleCallMutation = useMutation({
    mutationFn: (input: {
      title: string;
      description?: string;
      scheduledStartTime: string;
      scheduledEndTime?: string;
      timezone?: string;
      inviteeUserIds?: string[];
      roomId?: string;
      reminderMinutes?: number;
    }) => callApi.scheduleCall(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.list() });
    },
  });

  const cancelScheduledCallMutation = useMutation({
    mutationFn: (scheduledCallId: string) => callApi.cancelScheduledCall(scheduledCallId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.list() });
    },
  });

  return {
    recordings: recordingsQuery.data ?? [],
    isLoadingRecordings: recordingsQuery.isLoading,
    scheduledCalls: scheduledCallsQuery.data ?? [],
    isLoadingScheduledCalls: scheduledCallsQuery.isLoading,

    swapCalls: swapCallsMutation.mutateAsync,
    isSwapping: swapCallsMutation.isPending,

    blindTransfer: blindTransferMutation.mutateAsync,
    isTransferring: blindTransferMutation.isPending,

    initiateAttendedTransfer: initiateAttendedTransferMutation.mutateAsync,
    completeAttendedTransfer: completeAttendedTransferMutation.mutateAsync,

    mergeCalls: mergeCallsMutation.mutateAsync,
    isMerging: mergeCallsMutation.isPending,

    splitConferenceCall: splitConferenceCallMutation.mutateAsync,
    isSplitting: splitConferenceCallMutation.isPending,

    admitParticipant: admitParticipantMutation.mutateAsync,
    denyParticipant: denyParticipantMutation.mutateAsync,

    initiateDeviceTransfer: initiateDeviceTransferMutation.mutateAsync,
    completeDeviceTransfer: completeDeviceTransferMutation.mutateAsync,

    startRecording: startRecordingMutation.mutateAsync,
    pauseRecording: pauseRecordingMutation.mutateAsync,
    resumeRecording: resumeRecordingMutation.mutateAsync,
    stopRecording: stopRecordingMutation.mutateAsync,
    submitRecordingConsent: submitRecordingConsentMutation.mutateAsync,

    scheduleCall: scheduleCallMutation.mutateAsync,
    isScheduling: scheduleCallMutation.isPending,
    cancelScheduledCall: cancelScheduledCallMutation.mutateAsync,
    isCancellingScheduledCall: cancelScheduledCallMutation.isPending,
    refetchScheduledCalls: scheduledCallsQuery.refetch,
  };
}
