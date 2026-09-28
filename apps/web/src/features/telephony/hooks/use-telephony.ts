import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { telephonyApi } from '../services/telephony-api';
import {
  numberKeys,
  routingKeys,
  voicemailKeys,
  telephonyKeys,
  callKeys,
} from '../../../query/query-keys';
import {
  PhoneNumberType,
  PhoneNumberAssignmentType,
  RoutingTargetType,
} from '../types';

export function usePhoneNumbers(status?: string) {
  return useQuery({
    queryKey: numberKeys.list(status),
    queryFn: () => telephonyApi.getPhoneNumbers(status),
    staleTime: 30000,
  });
}

export function useAvailableNumbers(country = 'US', type = 'LOCAL') {
  return useQuery({
    queryKey: numberKeys.available(country, type),
    queryFn: () => telephonyApi.getAvailableNumbers(country, type),
    staleTime: 60000,
  });
}

export function useProvisionNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { country: string; type: PhoneNumberType; pattern?: string }) =>
      telephonyApi.provisionPhoneNumber(input),
    onSuccess: (newNumber) => {
      // Targeted invalidation
      queryClient.invalidateQueries({ queryKey: numberKeys.list() });
      queryClient.setQueryData(numberKeys.detail(newNumber.id), newNumber);
    },
  });
}

export function useAssignNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      numberId,
      assignedToType,
      assignedId,
    }: {
      numberId: string;
      assignedToType: PhoneNumberAssignmentType;
      assignedId: string;
    }) => telephonyApi.assignPhoneNumber(numberId, assignedToType, assignedId),
    onSuccess: (updatedNumber) => {
      queryClient.invalidateQueries({ queryKey: numberKeys.list() });
      queryClient.setQueryData(numberKeys.detail(updatedNumber.id), updatedNumber);
    },
  });
}

export function useUnassignNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (numberId: string) => telephonyApi.unassignPhoneNumber(numberId),
    onSuccess: (updatedNumber) => {
      queryClient.invalidateQueries({ queryKey: numberKeys.list() });
      queryClient.setQueryData(numberKeys.detail(updatedNumber.id), updatedNumber);
    },
  });
}

export function useReleaseNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (numberId: string) => telephonyApi.releasePhoneNumber(numberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: numberKeys.list() });
    },
  });
}

export function useInitiatePstnCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ to, callerId }: { to: string; callerId?: string }) =>
      telephonyApi.initiateOutboundPstnCall(to, callerId),
    onSuccess: () => {
      // Invalidate active call lists
      queryClient.invalidateQueries({ queryKey: callKeys.active() });
      queryClient.invalidateQueries({ queryKey: telephonyKeys.activeCalls() });
    },
  });
}

export function useSendDtmf() {
  return useMutation({
    mutationFn: ({ callSessionId, digits }: { callSessionId: string; digits: string }) =>
      telephonyApi.sendDtmf(callSessionId, digits),
  });
}

export function useInboundRoutingRules(phoneNumberId: string) {
  return useQuery({
    queryKey: routingKeys.forNumber(phoneNumberId),
    queryFn: () => telephonyApi.getInboundRoutingRules(phoneNumberId),
    enabled: Boolean(phoneNumberId),
    staleTime: 30000,
  });
}

export function useSetInboundRoutingRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      phoneNumberId: string;
      name: string;
      priority?: number;
      targetType: RoutingTargetType;
      targetId: string;
      ringDurationSeconds?: number;
      businessHoursOnly?: boolean;
      businessHoursStart?: string;
      businessHoursEnd?: string;
      timezone?: string;
      fallbackTargetType?: RoutingTargetType;
      fallbackTargetId?: string;
    }) => telephonyApi.setInboundRoutingRule(input),
    onSuccess: (newRule) => {
      queryClient.invalidateQueries({ queryKey: routingKeys.forNumber(newRule.phoneNumberId) });
    },
  });
}

export function useVoicemails() {
  return useQuery({
    queryKey: voicemailKeys.list(),
    queryFn: () => telephonyApi.getVoicemails(),
    staleTime: 15000,
  });
}

export function useMarkVoicemailRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (voicemailId: string) => telephonyApi.markVoicemailAsRead(voicemailId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: voicemailKeys.list() });
      queryClient.setQueryData(voicemailKeys.detail(updated.id), updated);
    },
  });
}

export function useDeleteVoicemail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (voicemailId: string) => telephonyApi.deleteVoicemail(voicemailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: voicemailKeys.list() });
    },
  });
}

export function useTelephonyUsage(limit = 20, offset = 0) {
  return useQuery({
    queryKey: telephonyKeys.usage({ limit, offset }),
    queryFn: () => telephonyApi.getTelephonyUsage(limit, offset),
    staleTime: 30000,
  });
}

export function useOutboundTelephonyPolicy() {
  return useQuery({
    queryKey: telephonyKeys.outboundPolicy(),
    queryFn: () => telephonyApi.getOutboundTelephonyPolicy(),
    staleTime: 60000,
  });
}
