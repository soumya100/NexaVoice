/**
 * NexaVoice Query Key Factories
 * 
 * Deterministic, collision-free query keys for TanStack Query.
 * All queries across the application must consume these factories.
 */

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
  sessions: () => [...authKeys.all, 'sessions'] as const,
};

export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  detail: (id: string) => [...conversationKeys.all, 'detail', id] as const,
  messages: (id: string, filters?: { limit?: number; cursor?: string }) =>
    [...conversationKeys.all, 'messages', id, filters ?? {}] as const,
  participants: (id: string) => [...conversationKeys.all, 'participants', id] as const,
};

export const contactKeys = {
  all: ['contacts'] as const,
  list: () => [...contactKeys.all, 'list'] as const,
  requests: () => [...contactKeys.all, 'requests'] as const,
  blocked: () => [...contactKeys.all, 'blocked'] as const,
};

export const healthKeys = {
  all: ['health'] as const,
  ready: () => [...healthKeys.all, 'ready'] as const,
};

export const securityKeys = {
  all: ['security'] as const,
  auditLogs: (limit?: number) => [...securityKeys.all, 'auditLogs', limit ?? 20] as const,
};

export const callKeys = {
  all: ['calls'] as const,
  detail: (id: string) => [...callKeys.all, 'detail', id] as const,
  active: () => [...callKeys.all, 'active'] as const,
  history: (limit?: number, offset?: number) =>
    [...callKeys.all, 'history', { limit: limit ?? 20, offset: offset ?? 0 }] as const,
  iceServers: (callId: string) => [...callKeys.all, 'iceServers', callId] as const,
};

export const conferenceKeys = {
  all: ['conferences'] as const,
  detail: (id: string) => [...conferenceKeys.all, 'detail', id] as const,
  participants: (id: string) => [...conferenceKeys.all, 'participants', id] as const,
};

export const roomKeys = {
  all: ['rooms'] as const,
  detail: (id: string) => [...roomKeys.all, 'detail', id] as const,
  members: (id: string) => [...roomKeys.all, 'members', id] as const,
};

export const recordingKeys = {
  all: ['recordings'] as const,
  forCall: (callId: string) => [...recordingKeys.all, 'forCall', callId] as const,
  playbackUrl: (recordingId: string) => [...recordingKeys.all, 'playbackUrl', recordingId] as const,
  transcripts: (recordingId: string) => [...recordingKeys.all, 'transcripts', recordingId] as const,
};

export const scheduleKeys = {
  all: ['scheduledCalls'] as const,
  list: () => [...scheduleKeys.all, 'list'] as const,
  detail: (id: string) => [...scheduleKeys.all, 'detail', id] as const,
};

export const telephonyKeys = {
  all: ['telephony'] as const,
  outboundPolicy: () => [...telephonyKeys.all, 'outboundPolicy'] as const,
  callerIds: () => [...telephonyKeys.all, 'callerIds'] as const,
  activeCalls: () => [...telephonyKeys.all, 'activeCalls'] as const,
  usage: (filters?: { limit?: number; offset?: number }) =>
    [...telephonyKeys.all, 'usage', filters ?? {}] as const,
};

export const numberKeys = {
  all: ['phoneNumbers'] as const,
  list: (status?: string) => [...numberKeys.all, 'list', status ?? 'all'] as const,
  detail: (id: string) => [...numberKeys.all, 'detail', id] as const,
  available: (country?: string, type?: string) =>
    [...numberKeys.all, 'available', country ?? 'US', type ?? 'LOCAL'] as const,
};

export const routingKeys = {
  all: ['routingRules'] as const,
  forNumber: (numberId: string) => [...routingKeys.all, 'forNumber', numberId] as const,
};

export const voicemailKeys = {
  all: ['voicemails'] as const,
  list: () => [...voicemailKeys.all, 'list'] as const,
  unreadCount: () => [...voicemailKeys.all, 'unreadCount'] as const,
  detail: (id: string) => [...voicemailKeys.all, 'detail', id] as const,
};

// ==========================================
// MILESTONE 7: AI, AGENTS & CALL INTELLIGENCE
// ==========================================

export const aiKeys = {
  all: ['ai'] as const,
  sessions: () => [...aiKeys.all, 'sessions'] as const,
  sessionDetail: (sessionId: string) => [...aiKeys.all, 'session', sessionId] as const,
  tools: () => [...aiKeys.all, 'tools'] as const,
};

export const agentKeys = {
  all: ['aiAgents'] as const,
  list: () => [...agentKeys.all, 'list'] as const,
  detail: (id: string) => [...agentKeys.all, 'detail', id] as const,
  versions: (agentId: string) => [...agentKeys.all, 'versions', agentId] as const,
};

export const transcriptKeys = {
  all: ['transcripts'] as const,
  forCall: (callId: string) => [...transcriptKeys.all, 'call', callId] as const,
};

export const summaryKeys = {
  all: ['callSummaries'] as const,
  forCall: (callId: string) => [...summaryKeys.all, 'call', callId] as const,
};

export const actionItemKeys = {
  all: ['actionItems'] as const,
  forCall: (callId: string) => [...actionItemKeys.all, 'call', callId] as const,
};
