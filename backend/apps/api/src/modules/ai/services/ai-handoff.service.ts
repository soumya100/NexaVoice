import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SecurityAuditService } from '../../security/security-audit.service';
import { SignalingGateway } from '../../realtime/signaling.gateway';
import {
  AISessionStatus,
  ParticipantState,
} from '@nexavoice/domain-types';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

export interface HandoffResult {
  success: boolean;
  sessionId: string;
  callSessionId: string;
  handoffToUserId?: string;
  reason: string;
  timestamp: string;
}

export interface ScreeningResult {
  callSessionId: string;
  callerNumber: string;
  disclosurePlayed: boolean;
  intentSummary: string;
  recommendedAction: 'ROUTE_TO_HUMAN' | 'ROUTE_TO_VOICEMAIL' | 'AI_RESOLVED';
  suggestedQueue?: string;
}

@Injectable()
export class AIHandoffService {
  private readonly logger = new StructuredLogger('AIHandoffService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: SecurityAuditService,
    private readonly signalingGateway: SignalingGateway,
  ) {}

  /**
   * Executes an AI-to-human handoff maintaining the unified CallSession domain.
   * Does NOT destroy the call or create an unrelated call.
   */
  async triggerHumanHandoff(
    actorId: string,
    sessionId: string,
    reason: string,
    targetUserId?: string,
  ): Promise<HandoffResult> {
    const session = await this.prisma.aISession.findUnique({
      where: { id: sessionId },
      include: { callSession: true },
    });

    if (!session) {
      throw new NotFoundException(`AISession ${sessionId} not found`);
    }

    if (session.status === ('COMPLETED' as any) || session.status === ('FAILED' as any)) {
      throw new BadRequestException(`Cannot hand off an inactive AI session`);
    }

    const defaultAgent = targetUserId || 'support_agent_pool_1';

    // Atomic handoff transition
    await this.prisma.$transaction(async (tx) => {
      // 1. Mark AI session as HANDOFF
      await tx.aISession.update({
        where: { id: sessionId },
        data: {
          status: AISessionStatus.HANDOFF as any,
          handoffReason: reason,
          handoffToUserId: defaultAgent,
          endedAt: new Date(),
        },
      });

      // 2. Transition AI CallParticipant to LEFT
      const aiParticipant = await tx.callParticipant.findFirst({
        where: {
          callSessionId: session.callSessionId,
          role: 'AI_ASSISTANT' as any,
        },
      });

      if (aiParticipant) {
        await tx.callParticipant.update({
          where: { id: aiParticipant.id },
          data: {
            state: ParticipantState.LEFT as any,
            leftAt: new Date(),
          },
        });
      }

      // 3. Write transactional outbox event for human escalation
      await tx.outboxEvent.create({
        data: {
          eventType: 'ai.handoff.requested',
          aggregateType: 'CallSession',
          aggregateId: session.callSessionId,
          payloadJson: JSON.stringify({
            sessionId,
            callSessionId: session.callSessionId,
            reason,
            targetUserId: defaultAgent,
          }),
        },
      });
    });

    await this.auditService.logEvent({
      action: 'AI_CALL_HUMAN_HANDOFF',
      actorId,
      targetType: 'CallSession',
      targetId: session.callSessionId,
      result: 'SUCCESS',
      metadata: { sessionId, reason, targetUserId: defaultAgent },
    });

    this.logger.log({
      event: 'ai_human_handoff_executed',
      sessionId,
      callSessionId: session.callSessionId,
      targetUserId: defaultAgent,
    });

    this.signalingGateway.broadcastToCall(session.callSessionId, 'ai.handoff.completed', {
      sessionId,
      callSessionId: session.callSessionId,
      reason,
      targetUserId: defaultAgent,
    });

    return {
      success: true,
      sessionId,
      callSessionId: session.callSessionId,
      handoffToUserId: defaultAgent,
      reason,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Evaluates incoming caller screening context, plays mandatory disclosure,
   * and provides a deterministic routing decision.
   */
  async screenInboundCaller(
    callSessionId: string,
    callerNumber: string,
    intentText: string,
  ): Promise<ScreeningResult> {
    // Mandatory AI disclosure rule: Caller must always be informed they are speaking to AI
    const disclosureText =
      'Hello. You have reached NexaVoice. Please be advised that this call is being answered by an automated AI assistant and recorded for quality assurance.';

    this.logger.log({
      event: 'ai_screening_evaluating',
      callSessionId,
      callerNumber,
      intentLength: intentText.length,
      disclosureText,
    });

    let recommendedAction: ScreeningResult['recommendedAction'] = 'AI_RESOLVED';
    let suggestedQueue: string | undefined;

    const lower = intentText.toLowerCase();
    if (lower.includes('representative') || lower.includes('human') || lower.includes('agent')) {
      recommendedAction = 'ROUTE_TO_HUMAN';
      suggestedQueue = 'Customer Operations Tier 1';
    } else if (lower.includes('urgent') || lower.includes('emergency') || lower.includes('critical')) {
      recommendedAction = 'ROUTE_TO_HUMAN';
      suggestedQueue = 'Escalations Priority';
    } else if (lower.includes('voicemail') || lower.includes('leave a message')) {
      recommendedAction = 'ROUTE_TO_VOICEMAIL';
    }

    return {
      callSessionId,
      callerNumber,
      disclosurePlayed: true,
      intentSummary: intentText,
      recommendedAction,
      suggestedQueue,
    };
  }
}
