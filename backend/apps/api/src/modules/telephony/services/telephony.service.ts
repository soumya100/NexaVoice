import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PhoneNumberNormalizerService } from './phone-number-normalizer.service';
import { TollFraudProtectionService } from './toll-fraud-protection.service';
import { PhoneNumberService } from './phone-number.service';
import { TelephonyRoutingService } from './telephony-routing.service';
import { VoicemailService } from './voicemail.service';
import { SecurityAuditService } from '../../security/security-audit.service';
import { SignalingGateway } from '../../realtime/signaling.gateway';
import { CallStateMachineService } from '../../calling/services/call-state-machine.service';
import {
  CallSessionStatus,
  CallType,
  ParticipantRole,
  ParticipantState,
  TelephonyUsageSummary,
} from '@nexavoice/domain-types';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

export interface InitiateOutboundPstnCallDto {
  to: string;
  from?: string;
  conversationId?: string;
}

@Injectable()
export class TelephonyService {
  private readonly logger = new StructuredLogger('TelephonyService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizer: PhoneNumberNormalizerService,
    private readonly fraudProtection: TollFraudProtectionService,
    private readonly numberService: PhoneNumberService,
    private readonly routingService: TelephonyRoutingService,
    private readonly voicemailService: VoicemailService,
    private readonly securityAudit: SecurityAuditService,
    private readonly signalingGateway: SignalingGateway,
    private readonly stateMachine: CallStateMachineService,
  ) {}

  /**
   * Initiates an outbound PSTN call using the existing CallSession/CallLeg domain.
   */
  async initiateOutboundPstnCall(
    actorId: string,
    input: InitiateOutboundPstnCallDto,
  ): Promise<{ callId: string; providerCallId?: string; status: string; destinationNumber: string }> {
    // 1. E.164 Normalization & Validation
    const normalizedTo = this.normalizer.normalize(input.to);
    if (!normalizedTo.isValid) {
      throw new BadRequestException(`Invalid destination phone number: '${input.to}'`);
    }

    if (normalizedTo.isEmergency) {
      this.logger.warn({
        event: 'emergency_call_attempted',
        actorId,
        number: normalizedTo.e164,
      });
      // Document limitation: emergency calls are provider-dependent
      throw new ForbiddenException(
        'Emergency calling (911/112/999) requires live carrier regulatory E911 configuration and is disabled in this environment.',
      );
    }

    // 2. Toll-Fraud Policy Check
    await this.fraudProtection.assertCanInitiateCall(actorId, normalizedTo);

    // 3. Resolve & Verify Caller ID
    let callerId = input.from;
    if (callerId) {
      const normalizedFrom = this.normalizer.normalize(callerId);
      if (!normalizedFrom.isValid) {
        throw new BadRequestException(`Invalid caller ID: '${callerId}'`);
      }
      callerId = normalizedFrom.e164;
    } else {
      callerId = await this.numberService.resolveCallerId(actorId);
    }

    const provider = this.numberService.getActiveProvider();

    // 4. Create CallSession & CallLegs inside database transaction
    const { call } = await this.prisma.$transaction(async (tx) => {
      // Create unified CallSession with callType: PSTN
      const session = await tx.callSession.create({
        data: {
          callType: CallType.PSTN as any,
          status: 'INITIATING',
          hostUserId: actorId,
          conversationId: input.conversationId,
          metadataJson: JSON.stringify({
            destinationNumber: normalizedTo.e164,
            callerId,
            provider: provider.providerName,
          }),
        },
      });

      // Host participant
      const hostPart = await tx.callParticipant.create({
        data: {
          callSessionId: session.id,
          userId: actorId,
          role: ParticipantRole.HOST as any,
          state: ParticipantState.CONNECTED as any,
        },
      });

      // Host leg (User to NexaVoice)
      await tx.callLeg.create({
        data: {
          callSessionId: session.id,
          participantId: hostPart.id,
          userId: actorId,
          direction: 'OUTBOUND',
          status: 'CONNECTED',
        },
      });

      // PSTN leg (NexaVoice to PSTN carrier)
      const leg = await tx.callLeg.create({
        data: {
          callSessionId: session.id,
          userId: actorId,
          direction: 'OUTBOUND',
          status: 'RINGING',
          metadataJson: JSON.stringify({
            destinationNumber: normalizedTo.e164,
            callerId,
          }),
        },
      });

      // Transactional Outbox Event
      await tx.outboxEvent.create({
        data: {
          eventType: 'telephony.call.initiated',
          aggregateType: 'User',
          aggregateId: actorId,
          payloadJson: JSON.stringify({
            callId: session.id,
            destinationNumber: normalizedTo.e164,
            callerId,
            provider: provider.providerName,
          }),
        },
      });

      return { call: session, pstnLeg: leg };
    });

    // 5. Delegate to Carrier Provider
    const providerResult = await provider.initiateOutboundCall({
      callId: call.id,
      to: normalizedTo.e164,
      from: callerId,
      record: false,
      timeoutSeconds: 30,
    });

    // 6. Record Durable Telephony Usage
    await this.prisma.telephonyUsage.create({
      data: {
        callSessionId: call.id,
        provider: provider.providerName,
        providerCallId: providerResult.providerCallId,
        sourceNumber: callerId,
        destinationNumber: normalizedTo.e164,
        direction: 'OUTBOUND',
        durationSeconds: 0,
        callStatus: providerResult.status,
      },
    });

    // 7. Security Audit Event
    await this.securityAudit.logEvent({
      action: 'OUTBOUND_PSTN_CALL_INITIATED',
      actorId,
      targetType: 'CallSession',
      targetId: call.id,
      result: providerResult.success ? 'SUCCESS' : 'FAILURE',
      metadata: {
        destinationNumber: normalizedTo.e164,
        callerId,
        provider: provider.providerName,
        providerCallId: providerResult.providerCallId,
      },
    });

    // 8. Update CallSession status to RINGING
    await this.stateMachine.transitionCallSession(
      call.id,
      ['NEW', 'INITIATING'] as any,
      CallSessionStatus.RINGING,
    );

    this.logger.log({
      event: 'pstn_call_created',
      callId: call.id,
      providerCallId: providerResult.providerCallId,
      destination: normalizedTo.e164,
    });

    return {
      callId: call.id,
      providerCallId: providerResult.providerCallId,
      status: providerResult.status,
      destinationNumber: normalizedTo.e164,
    };
  }

  /**
   * Processes verified asynchronous provider events (webhooks) with idempotency.
   */
  async processProviderEvent(
    providerName: string,
    headers: Record<string, string | string[] | undefined>,
    rawBody: string | Buffer,
    url: string,
  ): Promise<{ success: boolean; eventId?: string; duplicate?: boolean }> {
    const provider = this.numberService.getActiveProvider();

    // 1. Cryptographic Signature Verification
    const verification = await provider.verifyWebhook(headers, rawBody, url);
    if (!verification.isValid || !verification.normalizedEvent) {
      this.logger.warn({
        event: 'telephony_webhook_signature_rejected',
        provider: providerName,
        reason: verification.reason,
      });
      throw new ForbiddenException(`Webhook verification failed: ${verification.reason}`);
    }

    const event = verification.normalizedEvent;

    // 2. Idempotency Check: Prevent duplicate event processing
    const existing = await this.prisma.providerEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: event.provider,
          providerEventId: event.providerEventId,
        },
      },
    });

    if (existing) {
      this.logger.log({
        event: 'telephony_webhook_duplicate_ignored',
        providerEventId: event.providerEventId,
      });
      return { success: true, eventId: event.providerEventId, duplicate: true };
    }

    // 3. Persist ProviderEvent
    await this.prisma.providerEvent.create({
      data: {
        provider: event.provider,
        providerEventId: event.providerEventId,
        eventType: event.eventType,
        payloadJson: JSON.stringify(event.rawPayload),
        status: 'PROCESSED',
      },
    });

    // 4. Handle Inbound Routing or Active Call State Updates
    if (event.eventType === 'call.initiated' || event.eventType === 'call.ringing') {
      // Inbound route check
      const route = await this.routingService.resolveInboundRoute(event.to);

      if (route.targetType === 'REJECT') {
        await provider.hangupCall(event.providerCallId);
        return { success: true, eventId: event.providerEventId };
      }

      if (route.targetType === 'VOICEMAIL' && route.targetId) {
        // Route to voicemail
        const session = await this.prisma.callSession.create({
          data: {
            callType: CallType.PSTN as any,
            status: 'ENDED',
            hostUserId: route.targetId,
          },
        });
        await this.voicemailService.createVoicemail({
          callSessionId: session.id,
          callerNumber: event.from,
          recipientUserId: route.targetId,
          durationSeconds: event.callDurationSeconds || 15,
          recordingSessionId: undefined,
        });
        return { success: true, eventId: event.providerEventId };
      }

      if (route.targetType === 'USER' && route.targetId) {
        // Broadcast incoming call to target user's devices
        this.signalingGateway.broadcastToUser(route.targetId, 'call.incoming', {
          call: {
            id: `pstn-inbound-${Date.now()}`,
            callType: CallType.PSTN,
            status: CallSessionStatus.RINGING,
            callerNumber: event.from,
            destinationNumber: event.to,
          },
        });
      }
    } else if (event.eventType === 'call.answered') {
      // Update CallSession to ACTIVE
      const usage = await this.prisma.telephonyUsage.findFirst({
        where: { providerCallId: event.providerCallId },
      });
      if (usage) {
        await this.stateMachine.transitionCallSession(
          usage.callSessionId,
          [CallSessionStatus.RINGING, CallSessionStatus.CONNECTING],
          CallSessionStatus.ACTIVE,
        );
      }
    } else if (event.eventType === 'call.completed' || event.eventType === 'call.failed') {
      // Update CallSession to ENDED and update duration
      const usage = await this.prisma.telephonyUsage.findFirst({
        where: { providerCallId: event.providerCallId },
      });
      if (usage) {
        await this.prisma.telephonyUsage.update({
          where: { id: usage.id },
          data: {
            callStatus: event.eventType === 'call.completed' ? 'completed' : 'failed',
            durationSeconds: event.callDurationSeconds || 0,
            endedAt: new Date(),
          },
        });

        await this.stateMachine.transitionCallSession(
          usage.callSessionId,
          [CallSessionStatus.ACTIVE, CallSessionStatus.RINGING, CallSessionStatus.HELD],
          event.eventType === 'call.completed' ? CallSessionStatus.ENDED : CallSessionStatus.FAILED,
          undefined,
          event.eventType === 'call.completed' ? 'NORMAL_CLEARING' : 'CARRIER_FAILURE',
        );
      }
    }

    return { success: true, eventId: event.providerEventId };
  }

  /**
   * Transmits normalized DTMF tones during an active PSTN call.
   */
  async sendDtmf(actorId: string, callId: string, digits: string): Promise<void> {
    const sanitizedDigits = digits.replace(/[^0-9*#wW]/g, '');
    if (!sanitizedDigits) {
      throw new BadRequestException("DTMF digits must only contain 0-9, *, #, or 'w'");
    }

    const call = await this.prisma.callSession.findUnique({
      where: { id: callId },
      include: {
        participants: { where: { userId: actorId } },
        telephonyUsage: true,
      },
    });

    if (!call) throw new NotFoundException(`Call ${callId} not found`);
    if (call.participants.length === 0) {
      throw new ForbiddenException('Forbidden: You are not a participant in this call');
    }

    const usage = call.telephonyUsage[0];
    if (usage && usage.providerCallId) {
      const provider = this.numberService.getActiveProvider();
      await provider.sendDtmf(usage.providerCallId, sanitizedDigits);
    }

    this.signalingGateway.broadcastToCall(callId, 'call.dtmf.sent', {
      callId,
      actorId,
      digits: sanitizedDigits,
    });
  }

  async listUsage(actorId: string, limit = 50): Promise<TelephonyUsageSummary[]> {
    const records = await this.prisma.telephonyUsage.findMany({
      where: {
        callSession: {
          hostUserId: actorId,
        },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      callSessionId: r.callSessionId,
      provider: r.provider,
      providerCallId: r.providerCallId || undefined,
      sourceNumber: r.sourceNumber,
      destinationNumber: r.destinationNumber,
      direction: r.direction as 'INBOUND' | 'OUTBOUND',
      durationSeconds: r.durationSeconds,
      callStatus: r.callStatus,
      region: r.region || undefined,
      startedAt: r.startedAt.toISOString(),
      endedAt: r.endedAt ? r.endedAt.toISOString() : undefined,
    }));
  }
}
