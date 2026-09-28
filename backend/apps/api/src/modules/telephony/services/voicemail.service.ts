import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SecurityAuditService } from '../../security/security-audit.service';
import { VoicemailMessageSummary, VoicemailStatus } from '@nexavoice/domain-types';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

export interface CreateVoicemailDto {
  callSessionId: string;
  callerNumber: string;
  callerName?: string;
  recipientUserId: string;
  durationSeconds: number;
  recordingSessionId?: string;
  transcript?: string;
}

@Injectable()
export class VoicemailService {
  private readonly logger = new StructuredLogger('VoicemailService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  /**
   * Creates a durable VoicemailMessage linked to CallSession and RecordingSession.
   */
  async createVoicemail(input: CreateVoicemailDto): Promise<VoicemailMessageSummary> {
    const voicemail = await this.prisma.$transaction(async (tx) => {
      const created = await tx.voicemailMessage.create({
        data: {
          callSessionId: input.callSessionId,
          recordingSessionId: input.recordingSessionId,
          callerNumber: input.callerNumber,
          callerName: input.callerName,
          recipientUserId: input.recipientUserId,
          durationSeconds: input.durationSeconds,
          status: 'UNREAD',
          transcript: input.transcript,
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'telephony.voicemail.created',
          aggregateType: 'User',
          aggregateId: input.recipientUserId,
          payloadJson: JSON.stringify({
            voicemailId: created.id,
            callSessionId: input.callSessionId,
            callerNumber: input.callerNumber,
            durationSeconds: input.durationSeconds,
          }),
        },
      });

      return created;
    });

    await this.securityAudit.logEvent({
      action: 'VOICEMAIL_MESSAGE_CREATED',
      actorId: input.recipientUserId,
      targetType: 'VoicemailMessage',
      targetId: voicemail.id,
      result: 'SUCCESS',
      metadata: {
        callerNumber: input.callerNumber,
        callSessionId: input.callSessionId,
      },
    });

    this.logger.log({
      event: 'voicemail_created',
      voicemailId: voicemail.id,
      recipientUserId: input.recipientUserId,
      callerNumber: input.callerNumber,
    });

    return this.mapToSummary(voicemail);
  }

  async markAsRead(userId: string, voicemailId: string): Promise<VoicemailMessageSummary> {
    const vm = await this.prisma.voicemailMessage.findUnique({
      where: { id: voicemailId },
    });
    if (!vm) throw new NotFoundException(`Voicemail ${voicemailId} not found`);

    if (vm.recipientUserId !== userId) {
      throw new ForbiddenException('Forbidden: You can only access your own voicemails');
    }

    const updated = await this.prisma.voicemailMessage.update({
      where: { id: voicemailId },
      data: { status: 'READ' },
    });

    return this.mapToSummary(updated);
  }

  async archiveVoicemail(userId: string, voicemailId: string): Promise<VoicemailMessageSummary> {
    const vm = await this.prisma.voicemailMessage.findUnique({
      where: { id: voicemailId },
    });
    if (!vm) throw new NotFoundException(`Voicemail ${voicemailId} not found`);

    if (vm.recipientUserId !== userId) {
      throw new ForbiddenException('Forbidden: You can only access your own voicemails');
    }

    const updated = await this.prisma.voicemailMessage.update({
      where: { id: voicemailId },
      data: { status: 'ARCHIVED' },
    });

    return this.mapToSummary(updated);
  }

  async listVoicemails(
    userId: string,
    filter?: { status?: VoicemailStatus },
  ): Promise<VoicemailMessageSummary[]> {
    const where: any = { recipientUserId: userId };
    if (filter?.status) {
      where.status = filter.status;
    } else {
      where.status = { not: 'DELETED' };
    }

    const records = await this.prisma.voicemailMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        recordingSession: true,
      },
    });

    return records.map((r) => this.mapToSummary(r));
  }

  async getVoicemail(userId: string, voicemailId: string): Promise<VoicemailMessageSummary> {
    const vm = await this.prisma.voicemailMessage.findUnique({
      where: { id: voicemailId },
      include: { recordingSession: true },
    });
    if (!vm) throw new NotFoundException(`Voicemail ${voicemailId} not found`);

    if (vm.recipientUserId !== userId) {
      throw new ForbiddenException('Forbidden: You can only access your own voicemails');
    }

    return this.mapToSummary(vm);
  }

  private mapToSummary(record: any): VoicemailMessageSummary {
    const audioUrl = record.recordingSession?.storagePath
      ? `/api/v1/attachments/download/${record.recordingSession.id}`
      : undefined;

    return {
      id: record.id,
      callSessionId: record.callSessionId,
      recordingSessionId: record.recordingSessionId || undefined,
      callerNumber: record.callerNumber,
      callerName: record.callerName || undefined,
      recipientUserId: record.recipientUserId,
      durationSeconds: record.durationSeconds,
      status: record.status as unknown as VoicemailStatus,
      transcript: record.transcript || undefined,
      audioUrl,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
