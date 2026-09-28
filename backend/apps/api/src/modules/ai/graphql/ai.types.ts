import { ObjectType, Field, ID, Int, Float, InputType, registerEnumType } from '@nestjs/graphql';
import { AgentStatus, AISessionStatus, AITurnSpeaker } from '@nexavoice/domain-types';

registerEnumType(AgentStatus, { name: 'AgentStatus' });
registerEnumType(AISessionStatus, { name: 'AISessionStatus' });
registerEnumType(AITurnSpeaker, { name: 'AITurnSpeaker' });

@ObjectType()
export class AIAgentCapabilitiesGql {
  @Field() voiceInteraction: boolean;
  @Field() screenSharingAnalysis: boolean;
  @Field() toolExecution: boolean;
  @Field() humanHandoff: boolean;
  @Field() transcriptionAttribution: boolean;
  @Field() postCallSummarization: boolean;
}

@ObjectType()
export class AIAgentGql {
  @Field(() => ID) id: string;
  @Field() organizationId: string;
  @Field() name: string;
  @Field({ nullable: true }) description?: string;
  @Field(() => AgentStatus) status: AgentStatus;
  @Field({ nullable: true }) activeVersionId?: string;
  @Field(() => AIAgentCapabilitiesGql) capabilities: AIAgentCapabilitiesGql;
  @Field() createdAt: string;
  @Field() updatedAt: string;
}

@ObjectType()
export class AIAgentVersionGql {
  @Field(() => ID) id: string;
  @Field() agentId: string;
  @Field(() => Int) version: number;
  @Field() systemPrompt: string;
  @Field() voiceId: string;
  @Field() voiceProvider: string;
  @Field() model: string;
  @Field(() => Float) temperature: number;
  @Field(() => [String]) tools: string[];
  @Field({ nullable: true }) safetyPolicy?: string;
  @Field() createdAt: string;
}

@ObjectType()
export class AISessionGql {
  @Field(() => ID) id: string;
  @Field() callSessionId: string;
  @Field() agentId: string;
  @Field() agentVersionId: string;
  @Field(() => AISessionStatus) status: AISessionStatus;
  @Field() isInterrupted: boolean;
  @Field(() => Int) turnCount: number;
  @Field() startedAt: string;
  @Field({ nullable: true }) endedAt?: string;
  @Field({ nullable: true }) handoffReason?: string;
  @Field({ nullable: true }) handoffToUserId?: string;
}

@ObjectType()
export class AITurnGql {
  @Field(() => ID) id: string;
  @Field() sessionId: string;
  @Field(() => Int) turnNumber: number;
  @Field(() => AITurnSpeaker) speaker: AITurnSpeaker;
  @Field() text: string;
  @Field({ nullable: true }) audioUrl?: string;
  @Field() isInterrupted: boolean;
  @Field(() => Int, { nullable: true }) latencyMs?: number;
  @Field() timestamp: string;
}

@ObjectType()
export class AIToolDefinitionGql {
  @Field() name: string;
  @Field() description: string;
  @Field() isPrivileged: boolean;
  @Field() requiresConfirmation: boolean;
}

@ObjectType()
export class CallSummaryGql {
  @Field(() => ID) id: string;
  @Field() callSessionId: string;
  @Field() overview: string;
  @Field(() => [String]) keyPoints: string[];
  @Field({ nullable: true }) sentiment?: string;
  @Field(() => Float) confidence: number;
  @Field() createdAt: string;
}

@ObjectType()
export class ActionItemGql {
  @Field(() => ID) id: string;
  @Field() callSessionId: string;
  @Field() title: string;
  @Field({ nullable: true }) description?: string;
  @Field({ nullable: true }) assignee?: string;
  @Field({ nullable: true }) dueDate?: string;
  @Field(() => Float) confidence: number;
  @Field() isCompleted: boolean;
  @Field() createdAt: string;
}

@ObjectType()
export class HandoffResultGql {
  @Field() success: boolean;
  @Field() sessionId: string;
  @Field() callSessionId: string;
  @Field({ nullable: true }) handoffToUserId?: string;
  @Field() reason: string;
  @Field() timestamp: string;
}

@InputType()
export class CreateAIAgentGqlInput {
  @Field() name: string;
  @Field({ nullable: true }) description?: string;
  @Field({ nullable: true }) organizationId?: string;
  @Field() systemPrompt: string;
  @Field({ nullable: true }) model?: string;
  @Field({ nullable: true }) voiceId?: string;
  @Field({ nullable: true }) voiceProvider?: string;
  @Field(() => Float, { nullable: true }) temperature?: number;
  @Field(() => [String], { nullable: true }) tools?: string[];
  @Field({ nullable: true }) safetyPolicy?: string;
}

@InputType()
export class CreateAIAgentVersionGqlInput {
  @Field() agentId: string;
  @Field() systemPrompt: string;
  @Field({ nullable: true }) model?: string;
  @Field({ nullable: true }) voiceId?: string;
  @Field({ nullable: true }) voiceProvider?: string;
  @Field(() => Float, { nullable: true }) temperature?: number;
  @Field(() => [String], { nullable: true }) tools?: string[];
  @Field({ nullable: true }) safetyPolicy?: string;
}
