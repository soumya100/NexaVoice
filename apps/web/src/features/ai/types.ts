export type AgentStatus = 'DRAFT' | 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
export type AISessionStatus =
  | 'INITIALIZING'
  | 'LISTENING'
  | 'THINKING'
  | 'TOOL_CALLING'
  | 'SPEAKING'
  | 'HANDOFF'
  | 'COMPLETED'
  | 'FAILED';

export type AITurnSpeaker = 'USER' | 'AGENT' | 'SYSTEM' | 'TOOL';

export interface AIAgent {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: AgentStatus;
  activeVersionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIAgentVersion {
  id: string;
  agentId: string;
  version: number;
  systemPrompt: string;
  model: string;
  voiceId: string;
  voiceProvider: string;
  temperature: number;
  tools: string[];
  safetyPolicy?: string;
  createdAt: string;
}

export interface AISession {
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

export interface AITurn {
  id: string;
  sessionId: string;
  turnNumber: number;
  speaker: AITurnSpeaker;
  text: string;
  audioUrl?: string;
  isInterrupted: boolean;
  latencyMs?: number;
  toolCalls?: Array<{
    id: string;
    toolName: string;
    status: string;
  }>;
  createdAt: string;
}

export interface AIToolDefinition {
  name: string;
  description: string;
  parametersSchema: Record<string, any>;
  isPrivileged: boolean;
  requiresConfirmation: boolean;
}

export interface CallSummary {
  id: string;
  callSessionId: string;
  overview: string;
  keyPoints: string[];
  sentiment?: string;
  confidence: number;
  createdAt: string;
}

export interface ActionItem {
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

export interface CreateAgentInput {
  name: string;
  description?: string;
  systemPrompt: string;
  model?: string;
  voiceId?: string;
  tools?: string[];
  temperature?: number;
}
