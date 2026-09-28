import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '../services/ai-api';
import {
  aiKeys,
  agentKeys,
  summaryKeys,
  actionItemKeys,
  callKeys,
} from '../../../query/query-keys';
import { CreateAgentInput } from '../types';

export function useAIAgents() {
  return useQuery({
    queryKey: agentKeys.list(),
    queryFn: () => aiApi.getAgents(),
    staleTime: 30000,
  });
}

export function useAIAgent(id: string) {
  return useQuery({
    queryKey: agentKeys.detail(id),
    queryFn: () => aiApi.getAgent(id),
    enabled: Boolean(id),
    staleTime: 30000,
  });
}

export function useAIAgentVersions(agentId: string) {
  return useQuery({
    queryKey: agentKeys.versions(agentId),
    queryFn: () => aiApi.getAgentVersions(agentId),
    enabled: Boolean(agentId),
    staleTime: 30000,
  });
}

export function useCreateAIAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAgentInput) => aiApi.createAgent(input),
    onSuccess: (newAgent) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.list() });
      queryClient.setQueryData(agentKeys.detail(newAgent.id), newAgent);
    },
  });
}

export function useCreateAIAgentVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      agentId: string;
      systemPrompt: string;
      model?: string;
      voiceId?: string;
      tools?: string[];
    }) => aiApi.createAgentVersion(input),
    onSuccess: (newVersion) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.versions(newVersion.agentId) });
    },
  });
}

export function useActivateAIAgentVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentId, versionId }: { agentId: string; versionId: string }) =>
      aiApi.activateVersion(agentId, versionId),
    onSuccess: (updatedAgent) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.list() });
      queryClient.setQueryData(agentKeys.detail(updatedAgent.id), updatedAgent);
    },
  });
}

export function useUpdateAIAgentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentId, status }: { agentId: string; status: string }) =>
      aiApi.updateAgentStatus(agentId, status),
    onSuccess: (updatedAgent) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.list() });
      queryClient.setQueryData(agentKeys.detail(updatedAgent.id), updatedAgent);
    },
  });
}

export function useStartAISession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ callSessionId, agentId }: { callSessionId: string; agentId: string }) =>
      aiApi.startSession(callSessionId, agentId),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: aiKeys.sessions() });
      queryClient.setQueryData(aiKeys.sessionDetail(session.id), session);
      queryClient.invalidateQueries({ queryKey: callKeys.detail(session.callSessionId) });
    },
  });
}

export function useSendAIUtterance() {
  return useMutation({
    mutationFn: ({ sessionId, text }: { sessionId: string; text: string }) =>
      aiApi.sendUtterance(sessionId, text),
  });
}

export function useInterruptAISession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => aiApi.interruptSession(sessionId),
    onSuccess: (session) => {
      queryClient.setQueryData(aiKeys.sessionDetail(session.id), session);
    },
  });
}

export function useTriggerAIHandoff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      reason,
      targetUserId,
    }: {
      sessionId: string;
      reason: string;
      targetUserId?: string;
    }) => aiApi.triggerHandoff(sessionId, reason, targetUserId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: aiKeys.sessionDetail(result.sessionId) });
      queryClient.invalidateQueries({ queryKey: callKeys.detail(result.callSessionId) });
    },
  });
}

export function useCallSummary(callSessionId: string) {
  return useQuery({
    queryKey: summaryKeys.forCall(callSessionId),
    queryFn: () => aiApi.getCallSummary(callSessionId),
    enabled: Boolean(callSessionId),
    staleTime: 60000,
  });
}

export function useCallActionItems(callSessionId: string) {
  return useQuery({
    queryKey: actionItemKeys.forCall(callSessionId),
    queryFn: () => aiApi.getCallActionItems(callSessionId),
    enabled: Boolean(callSessionId),
    staleTime: 60000,
  });
}

export function useGenerateCallSummary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (callSessionId: string) => aiApi.generateSummary(callSessionId),
    onSuccess: (summary) => {
      queryClient.setQueryData(summaryKeys.forCall(summary.callSessionId), summary);
      queryClient.invalidateQueries({ queryKey: actionItemKeys.forCall(summary.callSessionId) });
    },
  });
}
