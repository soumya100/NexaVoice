import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/auth.decorators';
import { AuthorizationSubject, AgentStatus } from '@nexavoice/domain-types';
import { AIAgentService } from '../services/ai-agent.service';
import { AIOrchestrationService } from '../services/ai-orchestration.service';
import { AIHandoffService } from '../services/ai-handoff.service';
import { AIIntelligenceService } from '../services/ai-intelligence.service';
import { AIToolRegistryService } from '../tools/ai-tool-registry.service';
import {
  AIAgentGql,
  AIAgentVersionGql,
  AISessionGql,
  AITurnGql,
  AIToolDefinitionGql,
  CallSummaryGql,
  ActionItemGql,
  HandoffResultGql,
  CreateAIAgentGqlInput,
  CreateAIAgentVersionGqlInput,
} from './ai.types';

@Resolver()
@UseGuards(JwtAuthGuard)
export class AIResolver {
  constructor(
    private readonly agentService: AIAgentService,
    private readonly orchestrationService: AIOrchestrationService,
    private readonly handoffService: AIHandoffService,
    private readonly intelligenceService: AIIntelligenceService,
    private readonly toolRegistry: AIToolRegistryService,
  ) {}

  @Query(() => [AIAgentGql])
  async aiAgents(
    @Args('organizationId', { nullable: true }) organizationId?: string,
  ): Promise<AIAgentGql[]> {
    return this.agentService.listAgents(organizationId);
  }

  @Query(() => AIAgentGql)
  async aiAgent(@Args('agentId') agentId: string): Promise<AIAgentGql> {
    return this.agentService.getAgent(agentId);
  }

  @Query(() => [AIAgentVersionGql])
  async aiAgentVersions(@Args('agentId') agentId: string): Promise<AIAgentVersionGql[]> {
    return this.agentService.getAgentVersions(agentId);
  }

  @Query(() => AISessionGql)
  async aiSession(@Args('sessionId') sessionId: string): Promise<AISessionGql> {
    return this.orchestrationService.getSession(sessionId);
  }

  @Query(() => [AITurnGql])
  async aiSessionTurns(@Args('sessionId') sessionId: string): Promise<AITurnGql[]> {
    return this.orchestrationService.getSessionTurns(sessionId);
  }

  @Query(() => [AIToolDefinitionGql])
  async aiTools(): Promise<AIToolDefinitionGql[]> {
    return this.toolRegistry.getToolDefinitions();
  }

  @Query(() => CallSummaryGql, { nullable: true })
  async callSummary(@Args('callSessionId') callSessionId: string): Promise<CallSummaryGql | null> {
    return this.intelligenceService.getCallSummary(callSessionId);
  }

  @Query(() => [ActionItemGql])
  async actionItems(@Args('callSessionId') callSessionId: string): Promise<ActionItemGql[]> {
    return this.intelligenceService.getActionItems(callSessionId);
  }

  // ==========================================
  // Mutations
  // ==========================================

  @Mutation(() => AIAgentGql)
  async createAIAgent(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: CreateAIAgentGqlInput,
  ): Promise<AIAgentGql> {
    return this.agentService.createAgent(user.id, input);
  }

  @Mutation(() => AIAgentVersionGql)
  async createAIAgentVersion(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: CreateAIAgentVersionGqlInput,
  ): Promise<AIAgentVersionGql> {
    return this.agentService.createAgentVersion(user.id, input);
  }

  @Mutation(() => AIAgentGql)
  async activateAIAgentVersion(
    @CurrentUser() user: AuthorizationSubject,
    @Args('agentId') agentId: string,
    @Args('versionId') versionId: string,
  ): Promise<AIAgentGql> {
    return this.agentService.activateVersion(user.id, agentId, versionId);
  }

  @Mutation(() => AIAgentGql)
  async updateAIAgentStatus(
    @CurrentUser() user: AuthorizationSubject,
    @Args('agentId') agentId: string,
    @Args('status', { type: () => AgentStatus }) status: AgentStatus,
  ): Promise<AIAgentGql> {
    return this.agentService.updateStatus(user.id, agentId, status);
  }

  @Mutation(() => AISessionGql)
  async startAISession(
    @CurrentUser() user: AuthorizationSubject,
    @Args('callSessionId') callSessionId: string,
    @Args('agentId') agentId: string,
  ): Promise<AISessionGql> {
    return this.orchestrationService.startAISession(user.id, callSessionId, agentId);
  }

  @Mutation(() => AITurnGql)
  async processAIUtterance(
    @Args('sessionId') sessionId: string,
    @Args('text') text: string,
  ): Promise<AITurnGql> {
    const { agentTurn } = await this.orchestrationService.processUserUtterance(sessionId, text);
    return agentTurn;
  }

  @Mutation(() => AISessionGql)
  async interruptAISession(@Args('sessionId') sessionId: string): Promise<AISessionGql> {
    return this.orchestrationService.interruptSession(sessionId);
  }

  @Mutation(() => HandoffResultGql)
  async triggerHumanHandoff(
    @CurrentUser() user: AuthorizationSubject,
    @Args('sessionId') sessionId: string,
    @Args('reason') reason: string,
    @Args('targetUserId', { nullable: true }) targetUserId?: string,
  ): Promise<HandoffResultGql> {
    return this.handoffService.triggerHumanHandoff(user.id, sessionId, reason, targetUserId);
  }

  @Mutation(() => CallSummaryGql)
  async generateCallSummary(
    @Args('callSessionId') callSessionId: string,
  ): Promise<CallSummaryGql> {
    return this.intelligenceService.generateCallSummary(callSessionId);
  }

  @Mutation(() => ActionItemGql)
  async updateActionItemStatus(
    @Args('actionItemId') actionItemId: string,
    @Args('isCompleted') isCompleted: boolean,
  ): Promise<ActionItemGql> {
    return this.intelligenceService.updateActionItemStatus(actionItemId, isCompleted);
  }
}
