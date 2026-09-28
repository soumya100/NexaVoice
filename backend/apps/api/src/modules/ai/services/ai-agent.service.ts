import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SecurityAuditService } from '../../security/security-audit.service';
import {
  AgentStatus,
  canTransitionAgentStatus,
  AIAgentSummary,
  AIAgentVersionSummary,
} from '@nexavoice/domain-types';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

export interface CreateAgentInput {
  name: string;
  description?: string;
  organizationId?: string;
  systemPrompt: string;
  model?: string;
  voiceId?: string;
  voiceProvider?: string;
  temperature?: number;
  tools?: string[];
  safetyPolicy?: string;
}

export interface CreateAgentVersionInput {
  agentId: string;
  systemPrompt: string;
  model?: string;
  voiceId?: string;
  voiceProvider?: string;
  temperature?: number;
  tools?: string[];
  safetyPolicy?: string;
}

@Injectable()
export class AIAgentService {
  private readonly logger = new StructuredLogger('AIAgentService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: SecurityAuditService,
  ) {}

  /**
   * Creates a new AI Agent along with initial Version 1.
   */
  async createAgent(actorId: string, input: CreateAgentInput): Promise<AIAgentSummary> {
    const orgId = input.organizationId || 'org_default';

    const agent = await this.prisma.$transaction(async (tx) => {
      const createdAgent = await tx.aIAgent.create({
        data: {
          organizationId: orgId,
          name: input.name,
          description: input.description,
          status: AgentStatus.ACTIVE as any,
        },
      });

      const initialVersion = await tx.aIAgentVersion.create({
        data: {
          agentId: createdAgent.id,
          version: 1,
          systemPrompt: input.systemPrompt,
          model: input.model || 'gpt-4o',
          voiceId: input.voiceId || 'alloy',
          voiceProvider: input.voiceProvider || 'openai',
          temperature: input.temperature ?? 0.7,
          toolsJson: JSON.stringify(input.tools || []),
          safetyPolicyJson: JSON.stringify(input.safetyPolicy || {}),
        },
      });

      const updated = await tx.aIAgent.update({
        where: { id: createdAgent.id },
        data: { activeVersionId: initialVersion.id },
      });

      return updated;
    });

    await this.auditService.logEvent({
      action: 'AI_AGENT_CREATED',
      actorId,
      targetType: 'AIAgent',
      targetId: agent.id,
      result: 'SUCCESS',
      metadata: { name: agent.name, version: 1 },
    });

    this.logger.log({ event: 'ai_agent_created', agentId: agent.id, name: agent.name });

    return this.mapAgentSummary(agent);
  }

  /**
   * Creates a new immutable version for an existing agent.
   * Active agents must never have their active prompts mutated in-place.
   */
  async createAgentVersion(
    actorId: string,
    input: CreateAgentVersionInput,
  ): Promise<AIAgentVersionSummary> {
    const agent = await this.prisma.aIAgent.findUnique({
      where: { id: input.agentId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });

    if (!agent) {
      throw new NotFoundException(`AI Agent ${input.agentId} not found`);
    }

    if (agent.status === ('ARCHIVED' as any)) {
      throw new BadRequestException('Cannot create a version for an archived agent.');
    }

    const nextVersionNum = (agent.versions[0]?.version || 0) + 1;

    const newVersion = await this.prisma.aIAgentVersion.create({
      data: {
        agentId: input.agentId,
        version: nextVersionNum,
        systemPrompt: input.systemPrompt,
        model: input.model || 'gpt-4o',
        voiceId: input.voiceId || 'alloy',
        voiceProvider: input.voiceProvider || 'openai',
        temperature: input.temperature ?? 0.7,
        toolsJson: JSON.stringify(input.tools || []),
        safetyPolicyJson: JSON.stringify(input.safetyPolicy || {}),
      },
    });

    await this.auditService.logEvent({
      action: 'AI_AGENT_VERSION_CREATED',
      actorId,
      targetType: 'AIAgentVersion',
      targetId: newVersion.id,
      result: 'SUCCESS',
      metadata: { agentId: agent.id, version: nextVersionNum },
    });

    return this.mapVersionSummary(newVersion);
  }

  /**
   * Activates a specific agent version for subsequent calls.
   */
  async activateVersion(
    actorId: string,
    agentId: string,
    versionId: string,
  ): Promise<AIAgentSummary> {
    const version = await this.prisma.aIAgentVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.agentId !== agentId) {
      throw new NotFoundException(`Version ${versionId} does not belong to agent ${agentId}`);
    }

    const updated = await this.prisma.aIAgent.update({
      where: { id: agentId },
      data: { activeVersionId: versionId, status: AgentStatus.ACTIVE as any },
    });

    await this.auditService.logEvent({
      action: 'AI_AGENT_VERSION_ACTIVATED',
      actorId,
      targetType: 'AIAgent',
      targetId: agentId,
      result: 'SUCCESS',
      metadata: { activeVersionId: versionId },
    });

    return this.mapAgentSummary(updated);
  }

  /**
   * Transitions agent lifecycle state (DRAFT, ACTIVE, DISABLED, ARCHIVED).
   */
  async updateStatus(
    actorId: string,
    agentId: string,
    newStatus: AgentStatus,
  ): Promise<AIAgentSummary> {
    const agent = await this.prisma.aIAgent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException(`AI Agent ${agentId} not found`);

    if (!canTransitionAgentStatus(agent.status as any, newStatus)) {
      throw new BadRequestException(
        `Invalid agent state transition from ${agent.status} to ${newStatus}`,
      );
    }

    const updated = await this.prisma.aIAgent.update({
      where: { id: agentId },
      data: { status: newStatus as any },
    });

    await this.auditService.logEvent({
      action: 'AI_AGENT_STATUS_UPDATED',
      actorId,
      targetType: 'AIAgent',
      targetId: agentId,
      result: 'SUCCESS',
      metadata: { from: agent.status, to: newStatus },
    });

    return this.mapAgentSummary(updated);
  }

  async getAgent(agentId: string): Promise<AIAgentSummary> {
    const agent = await this.prisma.aIAgent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException(`AI Agent ${agentId} not found`);
    return this.mapAgentSummary(agent);
  }

  async listAgents(organizationId = 'org_default'): Promise<AIAgentSummary[]> {
    const agents = await this.prisma.aIAgent.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return agents.map((a) => this.mapAgentSummary(a));
  }

  async getAgentVersions(agentId: string): Promise<AIAgentVersionSummary[]> {
    const versions = await this.prisma.aIAgentVersion.findMany({
      where: { agentId },
      orderBy: { version: 'desc' },
    });
    return versions.map((v) => this.mapVersionSummary(v));
  }

  private mapAgentSummary(a: any): AIAgentSummary {
    return {
      id: a.id,
      organizationId: a.organizationId,
      name: a.name,
      description: a.description,
      status: a.status as AgentStatus,
      activeVersionId: a.activeVersionId,
      capabilities: {
        voiceInteraction: true,
        screenSharingAnalysis: false,
        toolExecution: true,
        humanHandoff: true,
        transcriptionAttribution: true,
        postCallSummarization: true,
      },
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  private mapVersionSummary(v: any): AIAgentVersionSummary {
    let tools: string[] = [];
    try {
      tools = JSON.parse(v.toolsJson || '[]');
    } catch {}

    return {
      id: v.id,
      agentId: v.agentId,
      version: v.version,
      systemPrompt: v.systemPrompt,
      voiceId: v.voiceId,
      voiceProvider: v.voiceProvider,
      model: v.model,
      temperature: v.temperature,
      tools,
      safetyPolicy: v.safetyPolicyJson,
      createdAt: v.createdAt.toISOString(),
    };
  }
}
