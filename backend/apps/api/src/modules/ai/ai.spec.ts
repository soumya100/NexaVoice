import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AIAgentService } from './services/ai-agent.service';
import { AIOrchestrationService } from './services/ai-orchestration.service';
import { AIHandoffService } from './services/ai-handoff.service';
import { AIIntelligenceService } from './services/ai-intelligence.service';
import { AIToolRegistryService } from './tools/ai-tool-registry.service';
import { MockAIProvider } from './providers/mock-ai.provider';
import { OpenAIAIProvider } from './providers/openai-ai.provider';
import { AnthropicAIProvider } from './providers/anthropic-ai.provider';
import { AIWorker } from './workers/ai.worker';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { SignalingGateway } from '../realtime/signaling.gateway';
import { ConfigService } from '@nestjs/config';
import { AgentStatus, AISessionStatus, ParticipantRole, ParticipantState, AIToolInvocation } from '@nexavoice/domain-types';

describe('Milestone 7: AI Voice, Agents & Call Intelligence Suite', () => {
  let agentService: AIAgentService;
  let orchestrationService: AIOrchestrationService;
  let handoffService: AIHandoffService;
  let intelligenceService: AIIntelligenceService;
  let toolRegistry: AIToolRegistryService;
  let mockAIProvider: MockAIProvider;
  let openAIProvider: OpenAIAIProvider;
  let anthropicProvider: AnthropicAIProvider;
  let worker: AIWorker;

  // In-memory mock database state
  const mockDb = {
    agents: new Map<string, any>(),
    agentVersions: new Map<string, any>(),
    callSessions: new Map<string, any>(),
    callParticipants: new Map<string, any>(),
    aiSessions: new Map<string, any>(),
    aiTurns: new Map<string, any>(),
    callSummaries: new Map<string, any>(),
    actionItems: new Map<string, any>(),
    outboxEvents: new Map<string, any>(),
    aiUsage: new Map<string, any>(),
  };

  const mockPrismaService: any = {
    $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrismaService)),
    aIAgent: {
      create: jest.fn(({ data }) => {
        const id = `agent_${Date.now()}_${Math.random()}`;
        const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
        mockDb.agents.set(id, record);
        return Promise.resolve(record);
      }),
      findUnique: jest.fn(({ where, include }) => {
        const agent = mockDb.agents.get(where.id);
        if (!agent) return Promise.resolve(null);
        if (include?.versions) {
          const versions = Array.from(mockDb.agentVersions.values()).filter(
            (v) => v.agentId === agent.id,
          );
          return Promise.resolve({ ...agent, versions });
        }
        return Promise.resolve(agent);
      }),
      findMany: jest.fn(() => Promise.resolve(Array.from(mockDb.agents.values()))),
      update: jest.fn(({ where, data }) => {
        const existing = mockDb.agents.get(where.id);
        if (!existing) throw new Error('Agent not found');
        const updated = { ...existing, ...data, updatedAt: new Date() };
        mockDb.agents.set(where.id, updated);
        return Promise.resolve(updated);
      }),
    },
    aIAgentVersion: {
      create: jest.fn(({ data }) => {
        const id = `ver_${Date.now()}_${Math.random()}`;
        const record = { id, createdAt: new Date(), ...data };
        mockDb.agentVersions.set(id, record);
        return Promise.resolve(record);
      }),
      findUnique: jest.fn(({ where }) => {
        return Promise.resolve(mockDb.agentVersions.get(where.id) || null);
      }),
      findMany: jest.fn(({ where }) => {
        const list = Array.from(mockDb.agentVersions.values()).filter(
          (v) => v.agentId === where.agentId,
        );
        return Promise.resolve(list);
      }),
    },
    callSession: {
      findUnique: jest.fn(({ where, include }) => {
        const call = mockDb.callSessions.get(where.id);
        if (!call) return Promise.resolve(null);
        const res: any = { ...call };
        if (include?.participants) {
          res.participants = Array.from(mockDb.callParticipants.values()).filter(
            (p) => p.callSessionId === call.id,
          );
        }
        if (include?.aiSessions) {
          res.aiSessions = Array.from(mockDb.aiSessions.values())
            .filter((s) => s.callSessionId === call.id)
            .map((s) => ({
              ...s,
              turns: Array.from(mockDb.aiTurns.values()).filter((t) => t.sessionId === s.id),
            }));
        }
        return Promise.resolve(res);
      }),
    },
    callParticipant: {
      create: jest.fn(({ data }) => {
        const id = `part_${Date.now()}_${Math.random()}`;
        const record = { id, joinedAt: new Date(), leftAt: null, ...data };
        mockDb.callParticipants.set(id, record);
        return Promise.resolve(record);
      }),
      findFirst: jest.fn(({ where }) => {
        const p = Array.from(mockDb.callParticipants.values()).find(
          (item) => item.callSessionId === where.callSessionId && item.role === where.role,
        );
        return Promise.resolve(p || null);
      }),
      update: jest.fn(({ where, data }) => {
        const existing = mockDb.callParticipants.get(where.id);
        if (!existing) throw new Error('Participant not found');
        const updated = { ...existing, ...data };
        mockDb.callParticipants.set(where.id, updated);
        return Promise.resolve(updated);
      }),
    },
    aISession: {
      create: jest.fn(({ data }) => {
        const id = `aisess_${Date.now()}_${Math.random()}`;
        const record = { id, createdAt: new Date(), startedAt: new Date(), endedAt: null, ...data };
        mockDb.aiSessions.set(id, record);
        return Promise.resolve(record);
      }),
      findUnique: jest.fn(({ where, include }) => {
        const session = mockDb.aiSessions.get(where.id);
        if (!session) return Promise.resolve(null);
        const res: any = { ...session };
        if (include?.callSession) {
          res.callSession = mockDb.callSessions.get(session.callSessionId);
        }
        if (include?.agentVersion) {
          res.agentVersion = mockDb.agentVersions.get(session.agentVersionId);
        }
        if (include?.turns) {
          res.turns = Array.from(mockDb.aiTurns.values()).filter(
            (t) => t.sessionId === session.id,
          );
        }
        return Promise.resolve(res);
      }),
      update: jest.fn(({ where, data }) => {
        const existing = mockDb.aiSessions.get(where.id);
        if (!existing) throw new Error('AISession not found');
        const updated = { ...existing, ...data };
        mockDb.aiSessions.set(where.id, updated);
        return Promise.resolve(updated);
      }),
    },
    aITurn: {
      create: jest.fn(({ data }) => {
        const id = `turn_${Date.now()}_${Math.random()}`;
        const record = { id, createdAt: new Date(), ...data };
        mockDb.aiTurns.set(id, record);
        return Promise.resolve(record);
      }),
    },
    aIUsage: {
      create: jest.fn(({ data }) => {
        const id = `usage_${Date.now()}_${Math.random()}`;
        const record = { id, createdAt: new Date(), ...data };
        mockDb.aiUsage.set(id, record);
        return Promise.resolve(record);
      }),
    },
    callSummary: {
      upsert: jest.fn(({ where, create, update }) => {
        const existing = Array.from(mockDb.callSummaries.values()).find(
          (s) => s.callSessionId === where.callSessionId,
        );
        if (existing) {
          const updated = { ...existing, ...update, updatedAt: new Date() };
          mockDb.callSummaries.set(existing.id, updated);
          return Promise.resolve(updated);
        }
        const id = `sum_${Date.now()}_${Math.random()}`;
        const created = { id, createdAt: new Date(), ...create };
        mockDb.callSummaries.set(id, created);
        return Promise.resolve(created);
      }),
    },
    actionItem: {
      findMany: jest.fn(({ where }) => {
        const items = Array.from(mockDb.actionItems.values()).filter(
          (a) => a.callSessionId === where.callSessionId,
        );
        return Promise.resolve(items);
      }),
      create: jest.fn(({ data }) => {
        const id = `act_${Date.now()}_${Math.random()}`;
        const record = { id, createdAt: new Date(), ...data };
        mockDb.actionItems.set(id, record);
        return Promise.resolve(record);
      }),
    },
    outboxEvent: {
      create: jest.fn(({ data }) => {
        const id = `evt_${Date.now()}_${Math.random()}`;
        const record = { id, status: 'PENDING', createdAt: new Date(), ...data };
        mockDb.outboxEvents.set(id, record);
        return Promise.resolve(record);
      }),
      findMany: jest.fn(({ where }) => {
        const events = Array.from(mockDb.outboxEvents.values()).filter((e) => {
          if (where.status && e.status !== where.status) return false;
          if (where.eventType?.in && !where.eventType.in.includes(e.eventType)) return false;
          return true;
        });
        return Promise.resolve(events);
      }),
      update: jest.fn(({ where, data }) => {
        const existing = mockDb.outboxEvents.get(where.id);
        if (!existing) throw new Error('Outbox event not found');
        const updated = { ...existing, ...data };
        mockDb.outboxEvents.set(where.id, updated);
        return Promise.resolve(updated);
      }),
    },
  };

  const mockAuditService = {
    logEvent: jest.fn().mockResolvedValue({ id: 'audit_123' }),
  };

  const mockSignalingGateway = {
    broadcastToCall: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'ai.openai.apiKey') return undefined; // testing unconfigured
      if (key === 'ai.anthropic.apiKey') return undefined;
      return undefined;
    }),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIAgentService,
        AIOrchestrationService,
        AIHandoffService,
        AIIntelligenceService,
        AIToolRegistryService,
        MockAIProvider,
        OpenAIAIProvider,
        AnthropicAIProvider,
        AIWorker,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SecurityAuditService, useValue: mockAuditService },
        { provide: SignalingGateway, useValue: mockSignalingGateway },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    agentService = module.get<AIAgentService>(AIAgentService);
    orchestrationService = module.get<AIOrchestrationService>(AIOrchestrationService);
    handoffService = module.get<AIHandoffService>(AIHandoffService);
    intelligenceService = module.get<AIIntelligenceService>(AIIntelligenceService);
    toolRegistry = module.get<AIToolRegistryService>(AIToolRegistryService);
    mockAIProvider = module.get<MockAIProvider>(MockAIProvider);
    openAIProvider = module.get<OpenAIAIProvider>(OpenAIAIProvider);
    anthropicProvider = module.get<AnthropicAIProvider>(AnthropicAIProvider);
    worker = module.get<AIWorker>(AIWorker);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.agents.clear();
    mockDb.agentVersions.clear();
    mockDb.callSessions.clear();
    mockDb.callParticipants.clear();
    mockDb.aiSessions.clear();
    mockDb.aiTurns.clear();
    mockDb.callSummaries.clear();
    mockDb.actionItems.clear();
    mockDb.outboxEvents.clear();
    mockDb.aiUsage.clear();
  });

  describe('1. AI Agent Domain & Immutable Versioning', () => {
    it('creates an agent with initial Version 1 and activates it atomically', async () => {
      const agent = await agentService.createAgent('user_admin', {
        name: 'Tier 1 Support Agent',
        description: 'Customer service agent for inbound help',
        systemPrompt: 'You are an intelligent support assistant.',
        model: 'gpt-4o',
        voiceId: 'alloy',
        tools: ['lookupCustomer', 'transferCall'],
      });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('Tier 1 Support Agent');
      expect(agent.status).toBe(AgentStatus.ACTIVE);
      expect(agent.activeVersionId).toBeDefined();

      const versions = await agentService.getAgentVersions(agent.id);
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe(1);
      expect(versions[0].systemPrompt).toBe('You are an intelligent support assistant.');

      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AI_AGENT_CREATED',
          targetType: 'AIAgent',
          targetId: agent.id,
          result: 'SUCCESS',
        }),
      );
    });

    it('creates Version 2 without in-place mutation of Version 1', async () => {
      const agent = await agentService.createAgent('user_admin', {
        name: 'Sales Inbound Agent',
        systemPrompt: 'Prompt v1',
      });

      const initialActiveVer = agent.activeVersionId;

      const v2 = await agentService.createAgentVersion('user_admin', {
        agentId: agent.id,
        systemPrompt: 'Prompt v2: improved qualification questions',
        tools: ['lookupCustomer', 'scheduleCall'],
      });

      expect(v2.version).toBe(2);
      expect(v2.systemPrompt).toContain('Prompt v2');

      // Verify active version is still Version 1 until explicitly activated
      const currentAgent = await agentService.getAgent(agent.id);
      expect(currentAgent.activeVersionId).toBe(initialActiveVer);

      // Now activate Version 2
      const updatedAgent = await agentService.activateVersion('user_admin', agent.id, v2.id);
      expect(updatedAgent.activeVersionId).toBe(v2.id);
    });

    it('enforces deterministic lifecycle state transitions and prevents archived agents from reactivation', async () => {
      const agent = await agentService.createAgent('user_admin', {
        name: 'Temporary Agent',
        systemPrompt: 'Prompt',
      });

      // ACTIVE -> DISABLED (valid)
      const disabled = await agentService.updateStatus('user_admin', agent.id, AgentStatus.DISABLED);
      expect(disabled.status).toBe(AgentStatus.DISABLED);

      // DISABLED -> ARCHIVED (valid)
      const archived = await agentService.updateStatus('user_admin', agent.id, AgentStatus.ARCHIVED);
      expect(archived.status).toBe(AgentStatus.ARCHIVED);

      // ARCHIVED -> ACTIVE (invalid: archived is terminal)
      await expect(
        agentService.updateStatus('user_admin', agent.id, AgentStatus.ACTIVE),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. AI Tool Execution Engine, Allowlisting & Security Sanitization', () => {
    it('executes allowlisted tool with valid schema parameters and sanitizes secrets', async () => {
      const invocation: AIToolInvocation = {
        id: 'inv_1',
        toolName: 'lookupCustomer',
        inputJson: JSON.stringify({ customerId: 'cust_999' }),
        status: 'REQUESTED',
      };

      const result = await toolRegistry.executeTool(invocation, {
        userId: 'user_1',
        callSessionId: 'call_1',
        agentId: 'agent_1',
        agentAllowlist: ['lookupCustomer', 'transferCall'],
      });

      expect(result.result).toBeDefined();
      expect(result.sanitizedResult).toBeDefined();
      expect(result.sanitizedResult.customerId).toBe('cust_999');
      // Verify internal security tokens are not leaked
      expect(result.sanitizedResult.authToken).toBeUndefined();
      expect(result.sanitizedResult.apiKey).toBeUndefined();
    });

    it('strictly blocks tool execution if tool is not in agent allowlist', async () => {
      const invocation: AIToolInvocation = {
        id: 'inv_2',
        toolName: 'transferCall',
        inputJson: JSON.stringify({ targetUserId: 'support_agent_2' }),
        status: 'REQUESTED',
      };

      // Agent allowlist only has lookupCustomer, not transferCall
      await expect(
        toolRegistry.executeTool(invocation, {
          userId: 'user_1',
          callSessionId: 'call_1',
          agentId: 'agent_1',
          agentAllowlist: ['lookupCustomer'],
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AI_UNAUTHORIZED_TOOL_INVOCATION_BLOCKED',
          result: 'FAILURE',
        }),
      );
    });

    it('rejects malformed JSON and missing required parameters with BadRequestException', async () => {
      const malformedInvocation: AIToolInvocation = {
        id: 'inv_3',
        toolName: 'lookupCustomer',
        inputJson: 'invalid_json{',
        status: 'REQUESTED',
      };

      await expect(
        toolRegistry.executeTool(malformedInvocation, {
          userId: 'user_1',
          callSessionId: 'call_1',
          agentId: 'agent_1',
          agentAllowlist: ['lookupCustomer'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. AI Conversation Orchestration & First-Class CallSession Integration', () => {
    let testCallId: string;
    let testAgentId: string;

    beforeEach(async () => {
      testCallId = 'call_unified_100';
      mockDb.callSessions.set(testCallId, {
        id: testCallId,
        status: 'ACTIVE',
        organizationId: 'org_default',
        hostUserId: 'host_1',
      });

      const agent = await agentService.createAgent('user_admin', {
        name: 'In-Call Voice Agent',
        systemPrompt: 'You are an AI assistant helping with call inquiries.',
        tools: ['lookupCustomer'],
      });
      testAgentId = agent.id;
    });

    it('attaches a first-class AI_ASSISTANT participant to the existing CallSession', async () => {
      const session = await orchestrationService.startAISession('user_caller', testCallId, testAgentId);

      expect(session).toBeDefined();
      expect(session.callSessionId).toBe(testCallId);
      expect(session.status).toBe(AISessionStatus.LISTENING);

      // Verify participant domain: participant created with role = AI_ASSISTANT
      const participant = Array.from(mockDb.callParticipants.values()).find(
        (p) => p.callSessionId === testCallId && p.role === ParticipantRole.AI_ASSISTANT,
      );
      expect(participant).toBeDefined();
      expect(participant?.state).toBe(ParticipantState.CONNECTED);
      expect(participant?.aiAgentId).toBe(testAgentId);

      expect(mockSignalingGateway.broadcastToCall).toHaveBeenCalledWith(
        testCallId,
        'ai.session.started',
        expect.objectContaining({ sessionId: session.id, agentId: testAgentId }),
      );
    });

    it('processes conversational turns and maintains defended context', async () => {
      const session = await orchestrationService.startAISession('user_caller', testCallId, testAgentId);

      // Turn: Normal user utterance
      const { userTurn, agentTurn } = await orchestrationService.processUserUtterance(
        session.id,
        'Hello, can you help me check my account status?',
      );

      expect(userTurn).toBeDefined();
      expect(userTurn.speaker).toBe('USER');
      expect(agentTurn).toBeDefined();
      expect(agentTurn.speaker).toBe('AGENT');
      expect(agentTurn.text).toBeDefined();
      expect(mockSignalingGateway.broadcastToCall).toHaveBeenCalledWith(
        testCallId,
        'ai.turn.completed',
        expect.objectContaining({ sessionId: session.id }),
      );
    });

    it('handles barge-in / interruption deterministically', async () => {
      const session = await orchestrationService.startAISession('user_caller', testCallId, testAgentId);

      const interrupted = await orchestrationService.interruptSession(session.id);

      expect(interrupted.isInterrupted).toBe(true);
      expect(interrupted.status).toBe(AISessionStatus.LISTENING);
    });
  });

  describe('4. Human Handoff & Inbound AI Screening', () => {
    it('executes human handoff: transitions AI participant to LEFT and retains CallSession lineage', async () => {
      const callId = 'call_handoff_200';
      mockDb.callSessions.set(callId, { id: callId, status: 'ACTIVE', hostUserId: 'host_1' });

      const agent = await agentService.createAgent('user_admin', {
        name: 'Screening Agent',
        systemPrompt: 'Screen calls',
      });

      const session = await orchestrationService.startAISession('user_caller', callId, agent.id);

      const handoff = await handoffService.triggerHumanHandoff(
        'user_caller',
        session.id,
        'Customer requested live human specialist',
        'support_rep_mary',
      );

      expect(handoff.success).toBe(true);
      expect(handoff.handoffToUserId).toBe('support_rep_mary');
      expect(handoff.callSessionId).toBe(callId);

      // Verify AI session updated to HANDOFF
      const updatedSession = mockDb.aiSessions.get(session.id);
      expect(updatedSession.status).toBe(AISessionStatus.HANDOFF);
      expect(updatedSession.handoffReason).toBe('Customer requested live human specialist');

      // Verify AI CallParticipant transitioned to LEFT
      const aiParticipant = Array.from(mockDb.callParticipants.values()).find(
        (p) => p.callSessionId === callId && p.role === ParticipantRole.AI_ASSISTANT,
      );
      expect(aiParticipant?.state).toBe(ParticipantState.LEFT);
      expect(aiParticipant?.leftAt).toBeDefined();

      // Verify Outbox Event created for human dispatch
      const outboxEvt = Array.from(mockDb.outboxEvents.values()).find(
        (e) => e.eventType === 'ai.handoff.requested',
      );
      expect(outboxEvt).toBeDefined();
      expect(outboxEvt.aggregateId).toBe(callId);
    });

    it('evaluates inbound screening intent with mandatory disclosure greeting', async () => {
      const screening = await handoffService.screenInboundCaller(
        'call_screening_300',
        '+1555019900',
        'I need to speak to a representative right away for emergency billing.',
      );

      expect(screening.disclosurePlayed).toBe(true);
      expect(screening.recommendedAction).toBe('ROUTE_TO_HUMAN');
      expect(screening.suggestedQueue).toBe('Customer Operations Tier 1');
    });
  });

  describe('5. Post-Call Intelligence, Action Items & Async Background Worker', () => {
    it('generates call summary and action items asynchronously from call dialogues', async () => {
      const callId = 'call_intel_400';
      mockDb.callSessions.set(callId, { id: callId, status: 'ENDED', hostUserId: 'host_1' });

      // Simulate dialogue turns
      const mockSessionId = 'aisess_intel_1';
      mockDb.aiSessions.set(mockSessionId, { id: mockSessionId, callSessionId: callId });
      mockDb.aiTurns.set('t1', {
        id: 't1',
        sessionId: mockSessionId,
        speaker: 'HUMAN',
        text: 'Can we schedule carrier porting next Tuesday?',
      });
      mockDb.aiTurns.set('t2', {
        id: 't2',
        sessionId: mockSessionId,
        speaker: 'AI',
        text: 'Certainly, I will assign the DID verification task to operations.',
      });

      const summary = await intelligenceService.generateCallSummary(callId);

      expect(summary).toBeDefined();
      expect(summary.callSessionId).toBe(callId);
      expect(summary.overview).toContain(callId);
      expect(summary.keyPoints.length).toBeGreaterThan(0);
      expect(summary.confidence).toBeGreaterThan(0.9);

      // Verify action items were created
      const actionItems = await intelligenceService.extractActionItems(callId);
      expect(actionItems.length).toBeGreaterThanOrEqual(2);
      expect(actionItems[0].assignee).toBeDefined();
      expect(actionItems[0].dueDate).toBeDefined();
    });

    it('processes outbox jobs in background worker without blocking live calls', async () => {
      const callId = 'call_async_500';
      mockDb.callSessions.set(callId, { id: callId, status: 'ENDED', hostUserId: 'host_1' });

      // Enqueue outbox event for call.ended
      mockDb.outboxEvents.set('evt_ended_1', {
        id: 'evt_ended_1',
        eventType: 'call.ended',
        aggregateType: 'CallSession',
        aggregateId: callId,
        status: 'PENDING',
      });

      const processedCount = await worker.processPendingJobs();
      expect(processedCount).toBe(1);

      // Event should now be PROCESSED
      const evt = mockDb.outboxEvents.get('evt_ended_1');
      expect(evt.status).toBe('PROCESSED');
      expect(evt.processedAt).toBeDefined();

      // Summary should have been generated for call_async_500
      const summary = Array.from(mockDb.callSummaries.values()).find(
        (s) => s.callSessionId === callId,
      );
      expect(summary).toBeDefined();
    });
  });

  describe('6. Provider Adapter Contracts & Capabilities Classification', () => {
    it('MockAIProvider (🟠 MOCK / TEST DOUBLE) satisfies LLM, STT, TTS, and Realtime interfaces', async () => {
      expect(mockAIProvider.providerName).toBe('mock-ai');
      expect(mockAIProvider.llmCapabilities.streaming).toBe(true);
      expect(mockAIProvider.sttCapabilities.streaming).toBe(true);
      expect(mockAIProvider.ttsCapabilities.streaming).toBe(true);
      expect(mockAIProvider.realtimeCapabilities.bargeIn).toBe(true);
      expect(mockAIProvider.realtimeCapabilities.audioStreaming).toBe(true);

      const llmRes = await mockAIProvider.generateResponse({
        model: 'mock-gpt',
        systemPrompt: 'You are mock.',
        messages: [{ role: 'user', content: 'Test prompt' }],
      });
      expect(llmRes.content).toBeDefined();

      const ttsRes = await mockAIProvider.synthesizeSpeech({ text: 'Hello NexaVoice' });
      expect(ttsRes.audioBuffer).toBeDefined();
      expect(ttsRes.mimeType).toBe('audio/wav');
    });

    it('OpenAIAIProvider (🟣 PROVIDER-DEPENDENT) safely guards against unconfigured API keys', async () => {
      expect(openAIProvider.providerName).toBe('openai');
      expect(openAIProvider.isConfigured()).toBe(false);

      await expect(
        openAIProvider.generateResponse({
          model: 'gpt-4o',
          systemPrompt: 'system',
          messages: [{ role: 'user', content: 'hi' }],
        }),
      ).rejects.toThrow('OpenAI API key is unconfigured on server');
    });

    it('AnthropicAIProvider (🟣 PROVIDER-DEPENDENT) safely guards against unconfigured API keys', async () => {
      expect(anthropicProvider.providerName).toBe('anthropic');
      expect(anthropicProvider.isConfigured()).toBe(false);

      await expect(
        anthropicProvider.generateResponse({
          model: 'claude-3-5-sonnet',
          systemPrompt: 'system',
          messages: [{ role: 'user', content: 'hi' }],
        }),
      ).rejects.toThrow('Anthropic API key is unconfigured on server');
    });
  });
});
