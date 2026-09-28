export enum AgentStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  ARCHIVED = 'ARCHIVED',
}

export const VALID_AGENT_STATUS_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  [AgentStatus.DRAFT]: [AgentStatus.ACTIVE, AgentStatus.ARCHIVED],
  [AgentStatus.ACTIVE]: [AgentStatus.DISABLED, AgentStatus.ARCHIVED],
  [AgentStatus.DISABLED]: [AgentStatus.ACTIVE, AgentStatus.ARCHIVED],
  [AgentStatus.ARCHIVED]: [], // Terminal state
};

export function canTransitionAgentStatus(from: AgentStatus, to: AgentStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_AGENT_STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export enum AISessionStatus {
  INITIALIZING = 'INITIALIZING',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  TOOL_CALLING = 'TOOL_CALLING',
  HANDOFF = 'HANDOFF',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export const VALID_AI_SESSION_TRANSITIONS: Record<AISessionStatus, AISessionStatus[]> = {
  [AISessionStatus.INITIALIZING]: [AISessionStatus.LISTENING, AISessionStatus.SPEAKING, AISessionStatus.FAILED],
  [AISessionStatus.LISTENING]: [AISessionStatus.THINKING, AISessionStatus.HANDOFF, AISessionStatus.COMPLETED, AISessionStatus.FAILED],
  [AISessionStatus.THINKING]: [AISessionStatus.SPEAKING, AISessionStatus.TOOL_CALLING, AISessionStatus.HANDOFF, AISessionStatus.FAILED],
  [AISessionStatus.TOOL_CALLING]: [AISessionStatus.THINKING, AISessionStatus.SPEAKING, AISessionStatus.HANDOFF, AISessionStatus.FAILED],
  [AISessionStatus.SPEAKING]: [AISessionStatus.LISTENING, AISessionStatus.HANDOFF, AISessionStatus.COMPLETED, AISessionStatus.FAILED],
  [AISessionStatus.HANDOFF]: [AISessionStatus.COMPLETED, AISessionStatus.FAILED],
  [AISessionStatus.COMPLETED]: [], // Terminal
  [AISessionStatus.FAILED]: [],    // Terminal
};

export function canTransitionAISession(from: AISessionStatus, to: AISessionStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_AI_SESSION_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export enum AITurnSpeaker {
  USER = 'USER',
  AGENT = 'AGENT',
  SYSTEM = 'SYSTEM',
  TOOL = 'TOOL',
}

export interface AIAgentCapability {
  voiceInteraction: boolean;
  screenSharingAnalysis: boolean;
  toolExecution: boolean;
  humanHandoff: boolean;
  transcriptionAttribution: boolean;
  postCallSummarization: boolean;
}

export interface AIAgentSummary {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: AgentStatus;
  activeVersionId?: string;
  capabilities: AIAgentCapability;
  createdAt: string;
  updatedAt: string;
}

export interface AIAgentVersionSummary {
  id: string;
  agentId: string;
  version: number;
  systemPrompt: string;
  voiceId: string;
  voiceProvider: string;
  model: string;
  temperature: number;
  tools: string[]; // tool names allowlisted
  safetyPolicy?: string;
  createdAt: string;
}

export interface AISessionSummary {
  id: string;
  callSessionId: string;
  agentId: string;
  agentVersionId: string;
  status: AISessionStatus;
  isInterrupted: boolean;
  turnCount: number;
  startedAt: string;
  endedAt?: string;
  handoffReason?: string;
  handoffToUserId?: string;
}

export interface AITurnSummary {
  id: string;
  sessionId: string;
  turnNumber: number;
  speaker: AITurnSpeaker;
  text: string;
  audioUrl?: string;
  isInterrupted: boolean;
  latencyMs?: number;
  timestamp: string;
}

export interface AIToolDefinition {
  name: string;
  description: string;
  parametersSchema: Record<string, any>;
  isPrivileged: boolean;
  requiresConfirmation: boolean;
}

export interface AIToolInvocation {
  id: string;
  toolName: string;
  inputJson: string;
  outputJson?: string;
  status: 'REQUESTED' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  error?: string;
}

export interface CallSummarySummary {
  id: string;
  callSessionId: string;
  overview: string;
  keyPoints: string[];
  sentiment?: string;
  confidence: number;
  createdAt: string;
}

export interface ActionItemSummary {
  id: string;
  callSessionId: string;
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  confidence: number;
  isCompleted: boolean;
  createdAt: string;
}

export interface AIUsageSummary {
  id: string;
  aiSessionId?: string;
  callSessionId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  audioSeconds: number;
  sttSeconds: number;
  ttsSeconds: number;
  createdAt: string;
}

export interface LLMProviderCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  structuredOutput: boolean;
  systemPromptVersion: boolean;
}

export interface STTProviderCapabilities {
  streaming: boolean;
  partialResults: boolean;
  speakerDiarization: boolean;
  wordTimestamps: boolean;
}

export interface TTSProviderCapabilities {
  streaming: boolean;
  customVoices: boolean;
  speedControl: boolean;
  pitchControl: boolean;
}

export interface RealtimeVoiceProviderCapabilities {
  bargeIn: boolean;
  serverVAD: boolean;
  clientVAD: boolean;
  audioStreaming: boolean;
}
