import { executeGraphQL } from '../../../services/api';
import {
  AIAgent,
  AIAgentVersion,
  AISession,
  AITurn,
  CallSummary,
  ActionItem,
  CreateAgentInput,
} from '../types';

const AGENT_FIELDS = `
  id
  organizationId
  name
  description
  status
  activeVersionId
  createdAt
  updatedAt
`;

const AGENT_VERSION_FIELDS = `
  id
  agentId
  version
  systemPrompt
  model
  voiceId
  voiceProvider
  temperature
  tools
  safetyPolicy
  createdAt
`;

const SESSION_FIELDS = `
  id
  callSessionId
  agentId
  agentVersionId
  status
  isInterrupted
  turnCount
  startedAt
  endedAt
  handoffReason
  handoffToUserId
`;

const TURN_FIELDS = `
  id
  sessionId
  turnNumber
  speaker
  text
  audioUrl
  isInterrupted
  latencyMs
  createdAt
`;

const SUMMARY_FIELDS = `
  id
  callSessionId
  overview
  keyPoints
  sentiment
  confidence
  createdAt
`;

const ACTION_ITEM_FIELDS = `
  id
  callSessionId
  title
  description
  assignee
  dueDate
  confidence
  isCompleted
  createdAt
`;

export const aiApi = {
  async getAgents(): Promise<AIAgent[]> {
    const query = `
      query GetAIAgents {
        aiAgents {
          ${AGENT_FIELDS}
        }
      }
    `;
    const data = await executeGraphQL<{ aiAgents: AIAgent[] }>(query);
    return data.aiAgents;
  },

  async getAgent(id: string): Promise<AIAgent> {
    const query = `
      query GetAIAgent($id: String!) {
        aiAgent(id: $id) {
          ${AGENT_FIELDS}
        }
      }
    `;
    const data = await executeGraphQL<{ aiAgent: AIAgent }>(query, { id });
    return data.aiAgent;
  },

  async getAgentVersions(agentId: string): Promise<AIAgentVersion[]> {
    const query = `
      query GetAgentVersions($agentId: String!) {
        aiAgentVersions(agentId: $agentId) {
          ${AGENT_VERSION_FIELDS}
        }
      }
    `;
    const data = await executeGraphQL<{ aiAgentVersions: AIAgentVersion[] }>(query, { agentId });
    return data.aiAgentVersions;
  },

  async createAgent(input: CreateAgentInput): Promise<AIAgent> {
    const mutation = `
      mutation CreateAgent($input: CreateAIAgentInput!) {
        createAIAgent(input: $input) {
          ${AGENT_FIELDS}
        }
      }
    `;
    const data = await executeGraphQL<{ createAIAgent: AIAgent }>(mutation, { input });
    return data.createAIAgent;
  },

  async createAgentVersion(input: {
    agentId: string;
    systemPrompt: string;
    model?: string;
    voiceId?: string;
    tools?: string[];
  }): Promise<AIAgentVersion> {
    const mutation = `
      mutation CreateAgentVersion($input: CreateAIAgentVersionInput!) {
        createAIAgentVersion(input: $input) {
          ${AGENT_VERSION_FIELDS}
        }
      }
    `;
    const data = await executeGraphQL<{ createAIAgentVersion: AIAgentVersion }>(mutation, { input });
    return data.createAIAgentVersion;
  },

  async activateVersion(agentId: string, versionId: string): Promise<AIAgent> {
    const mutation = `
      mutation ActivateVersion($agentId: String!, $versionId: String!) {
        activateAIAgentVersion(agentId: $agentId, versionId: $versionId) {
          ${AGENT_FIELDS}
        }
      }
    `;
    const data = await executeGraphQL<{ activateAIAgentVersion: AIAgent }>(mutation, {
      agentId,
      versionId,
    });
    return data.activateAIAgentVersion;
  },

  async updateAgentStatus(agentId: string, status: string): Promise<AIAgent> {
    const mutation = `
      mutation UpdateAgentStatus($agentId: String!, $status: String!) {
        updateAIAgentStatus(agentId: $agentId, status: $status) {
          ${AGENT_FIELDS}
        }
      }
    `;
    const data = await executeGraphQL<{ updateAIAgentStatus: AIAgent }>(mutation, {
      agentId,
      status,
    });
    return data.updateAIAgentStatus;
  },

  async startSession(callSessionId: string, agentId: string): Promise<AISession> {
    const mutation = `
      mutation StartAISession($callSessionId: String!, $agentId: String!) {
        startAISession(callSessionId: $callSessionId, agentId: $agentId) {
          ${SESSION_FIELDS}
        }
      }
    `;
    const data = await executeGraphQL<{ startAISession: AISession }>(mutation, {
      callSessionId,
      agentId,
    });
    return data.startAISession;
  },

  async sendUtterance(sessionId: string, text: string): Promise<AITurn> {
    const mutation = `
      mutation SendUtterance($sessionId: String!, $text: String!) {
        sendAIUtterance(sessionId: $sessionId, text: $text) {
          ${TURN_FIELDS}
        }
      }
    `;
    const data = await executeGraphQL<{ sendAIUtterance: AITurn }>(mutation, { sessionId, text });
    return data.sendAIUtterance;
  },

  async interruptSession(sessionId: string): Promise<AISession> {
    const mutation = `
      mutation InterruptAISession($sessionId: String!) {
        interruptAISession(sessionId: $sessionId) {
          ${SESSION_FIELDS}
        }
      }
    `;
    const data = await executeGraphQL<{ interruptAISession: AISession }>(mutation, { sessionId });
    return data.interruptAISession;
  },

  async triggerHandoff(sessionId: string, reason: string, targetUserId?: string): Promise<{
    success: boolean;
    sessionId: string;
    callSessionId: string;
    handoffToUserId?: string;
    reason: string;
    timestamp: string;
  }> {
    const mutation = `
      mutation TriggerAIHandoff($sessionId: String!, $reason: String!, $targetUserId: String) {
        triggerAIHandoff(sessionId: $sessionId, reason: $reason, targetUserId: $targetUserId) {
          success
          sessionId
          callSessionId
          handoffToUserId
          reason
          timestamp
        }
      }
    `;
    const data = await executeGraphQL<{
      triggerAIHandoff: {
        success: boolean;
        sessionId: string;
        callSessionId: string;
        handoffToUserId?: string;
        reason: string;
        timestamp: string;
      };
    }>(mutation, { sessionId, reason, targetUserId });
    return data.triggerAIHandoff;
  },

  async getCallSummary(callSessionId: string): Promise<CallSummary> {
    const query = `
      query GetCallSummary($callSessionId: String!) {
        callSummary(callSessionId: $callSessionId) {
          ${SUMMARY_FIELDS}
        }
      }
    `;
    const data = await executeGraphQL<{ callSummary: CallSummary }>(query, { callSessionId });
    return data.callSummary;
  },

  async getCallActionItems(callSessionId: string): Promise<ActionItem[]> {
    const query = `
      query GetActionItems($callSessionId: String!) {
        callActionItems(callSessionId: $callSessionId) {
          ${ACTION_ITEM_FIELDS}
        }
      }
    `;
    const data = await executeGraphQL<{ callActionItems: ActionItem[] }>(query, { callSessionId });
    return data.callActionItems;
  },

  async generateSummary(callSessionId: string): Promise<CallSummary> {
    const mutation = `
      mutation GenerateSummary($callSessionId: String!) {
        generateCallSummary(callSessionId: $callSessionId) {
          ${SUMMARY_FIELDS}
        }
      }
    `;
    const data = await executeGraphQL<{ generateCallSummary: CallSummary }>(mutation, {
      callSessionId,
    });
    return data.generateCallSummary;
  },
};
