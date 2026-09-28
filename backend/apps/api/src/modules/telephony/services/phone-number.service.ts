import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PhoneNumberNormalizerService } from './phone-number-normalizer.service';
import { MockTelephonyProvider } from '../providers/mock-telephony.provider';
import { TwilioTelephonyProvider } from '../providers/twilio-telephony.provider';
import { TelnyxTelephonyProvider } from '../providers/telnyx-telephony.provider';
import { TelephonyProvider } from '../telephony-provider.interface';
import { SecurityAuditService } from '../../security/security-audit.service';
import { ConfigService } from '@nestjs/config';
import {
  PhoneNumberStatus,
  PhoneNumberType,
  PhoneNumberAssignmentType,
  canTransitionPhoneNumber,
  PhoneNumberSummary,
} from '@nexavoice/domain-types';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

export interface ProvisionNumberDto {
  countryCode: string;
  type?: PhoneNumberType;
  areaCode?: string;
  desiredNumber?: string;
}

export interface AssignNumberDto {
  targetType: PhoneNumberAssignmentType;
  targetId: string;
}

@Injectable()
export class PhoneNumberService {
  private readonly logger = new StructuredLogger('PhoneNumberService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizer: PhoneNumberNormalizerService,
    private readonly mockProvider: MockTelephonyProvider,
    private readonly twilioProvider: TwilioTelephonyProvider,
    private readonly telnyxProvider: TelnyxTelephonyProvider,
    private readonly securityAudit: SecurityAuditService,
    private readonly configService: ConfigService,
  ) {}

  getActiveProvider(): TelephonyProvider {
    const configured = this.configService.get<string>('telephony.provider', 'mock');
    if (configured === 'twilio' && this.twilioProvider.isConfigured()) {
      return this.twilioProvider;
    }
    if (configured === 'telnyx' && this.telnyxProvider.isConfigured()) {
      return this.telnyxProvider;
    }
    return this.mockProvider;
  }

  /**
   * Provisions a new telephone number from the active telephony carrier.
   */
  async provisionNumber(actorId: string, input: ProvisionNumberDto): Promise<PhoneNumberSummary> {
    const provider = this.getActiveProvider();

    // 1. Delegate provisioning to provider
    const providerResult = await provider.provisionNumber({
      countryCode: input.countryCode,
      type: input.type as any,
      areaCode: input.areaCode,
      desiredNumber: input.desiredNumber,
    });

    if (!providerResult.success) {
      throw new BadRequestException(
        `Failed to provision number from carrier ${provider.providerName}: ${providerResult.error}`,
      );
    }

    const normalized = this.normalizer.normalize(providerResult.e164Number, input.countryCode);

    // 2. Persist in database inside transaction with outbox event
    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.phoneNumber.create({
        data: {
          e164Number: normalized.e164,
          displayNumber: normalized.display,
          countryCode: normalized.countryCode,
          type: (input.type as any) || 'LOCAL',
          status: 'ACTIVE',
          provider: providerResult.provider,
          providerResourceId: providerResult.providerResourceId,
          capabilitiesJson: JSON.stringify(providerResult.capabilities),
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'telephony.number.provisioned',
          aggregateType: 'PhoneNumber',
          aggregateId: created.id,
          payloadJson: JSON.stringify({
            numberId: created.id,
            e164Number: created.e164Number,
            actorId,
          }),
        },
      });

      return created;
    });

    // 3. Security Audit Event
    await this.securityAudit.logEvent({
      action: 'PHONE_NUMBER_PROVISIONED',
      actorId,
      targetType: 'PhoneNumber',
      targetId: record.id,
      result: 'SUCCESS',
      metadata: {
        e164Number: record.e164Number,
        provider: record.provider,
      },
    });

    return this.mapToSummary(record);
  }

  /**
   * Assigns an active phone number to a User, Room, or Organization.
   */
  async assignNumber(actorId: string, numberId: string, input: AssignNumberDto): Promise<PhoneNumberSummary> {
    const numberRecord = await this.prisma.phoneNumber.findUnique({
      where: { id: numberId },
    });

    if (!numberRecord) {
      throw new NotFoundException(`Phone number ${numberId} not found`);
    }

    const currentStatus = numberRecord.status as unknown as PhoneNumberStatus;
    if (!canTransitionPhoneNumber(currentStatus, PhoneNumberStatus.ASSIGNED)) {
      throw new BadRequestException(
        `Cannot assign phone number currently in state '${currentStatus}'. Expected 'ACTIVE'.`,
      );
    }

    // Verify target existence
    if (input.targetType === PhoneNumberAssignmentType.USER) {
      const user = await this.prisma.user.findUnique({ where: { id: input.targetId } });
      if (!user) throw new NotFoundException(`Target user ${input.targetId} does not exist`);
    } else if (input.targetType === PhoneNumberAssignmentType.ROOM) {
      const room = await this.prisma.callRoom.findUnique({ where: { id: input.targetId } });
      if (!room) throw new NotFoundException(`Target room ${input.targetId} does not exist`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const num = await tx.phoneNumber.update({
        where: { id: numberId },
        data: {
          status: 'ASSIGNED',
          assignedType: input.targetType as any,
          assignedId: input.targetId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'telephony.number.assigned',
          aggregateType: 'PhoneNumber',
          aggregateId: num.id,
          payloadJson: JSON.stringify({
            numberId: num.id,
            assignedType: input.targetType,
            assignedId: input.targetId,
            actorId,
          }),
        },
      });

      return num;
    });

    await this.securityAudit.logEvent({
      action: 'PHONE_NUMBER_ASSIGNED',
      actorId,
      targetType: 'PhoneNumber',
      targetId: updated.id,
      result: 'SUCCESS',
      metadata: {
        e164Number: updated.e164Number,
        assignedType: input.targetType,
        assignedId: input.targetId,
      },
    });

    return this.mapToSummary(updated);
  }

  /**
   * Releases an assigned number back to the unassigned active pool.
   */
  async unassignNumber(actorId: string, numberId: string): Promise<PhoneNumberSummary> {
    const numberRecord = await this.prisma.phoneNumber.findUnique({
      where: { id: numberId },
    });

    if (!numberRecord) {
      throw new NotFoundException(`Phone number ${numberId} not found`);
    }

    if (numberRecord.status !== 'ASSIGNED') {
      throw new BadRequestException(`Phone number is not currently assigned (status: ${numberRecord.status})`);
    }

    const updated = await this.prisma.phoneNumber.update({
      where: { id: numberId },
      data: {
        status: 'ACTIVE',
        assignedType: null,
        assignedId: null,
      },
    });

    this.logger.log({
      event: 'phone_number_unassigned',
      actorId,
      numberId,
    });

    return this.mapToSummary(updated);
  }

  /**
   * Permanently releases a telephone number back to the carrier provider.
   */
  async releaseNumber(actorId: string, numberId: string): Promise<PhoneNumberSummary> {
    const numberRecord = await this.prisma.phoneNumber.findUnique({
      where: { id: numberId },
      include: {
        usageRecords: {
          where: { endedAt: null },
        },
      },
    });

    if (!numberRecord) {
      throw new NotFoundException(`Phone number ${numberId} not found`);
    }

    // Verify no active calls on this number
    if (numberRecord.usageRecords && numberRecord.usageRecords.length > 0) {
      throw new BadRequestException(
        `Cannot release phone number with ${numberRecord.usageRecords.length} active calls in progress`,
      );
    }

    const currentStatus = numberRecord.status as unknown as PhoneNumberStatus;
    if (!canTransitionPhoneNumber(currentStatus, PhoneNumberStatus.RELEASING)) {
      throw new BadRequestException(`Cannot release phone number from state '${currentStatus}'`);
    }

    // Release at carrier
    const provider = this.getActiveProvider();
    if (numberRecord.providerResourceId) {
      await provider.releaseNumber(numberRecord.providerResourceId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const num = await tx.phoneNumber.update({
        where: { id: numberId },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
          assignedType: null,
          assignedId: null,
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'telephony.number.released',
          aggregateType: 'PhoneNumber',
          aggregateId: num.id,
          payloadJson: JSON.stringify({
            numberId: num.id,
            e164Number: num.e164Number,
            actorId,
          }),
        },
      });

      return num;
    });

    await this.securityAudit.logEvent({
      action: 'PHONE_NUMBER_RELEASED',
      actorId,
      targetType: 'PhoneNumber',
      targetId: updated.id,
      result: 'SUCCESS',
      metadata: {
        e164Number: updated.e164Number,
      },
    });

    return this.mapToSummary(updated);
  }

  /**
   * Resolves the authoritative caller ID for a user.
   * Checks:
   * 1. If user has an assigned phone number, uses that.
   * 2. Else fallback to system/default caller ID.
   */
  async resolveCallerId(userId: string): Promise<string> {
    const userNumber = await this.prisma.phoneNumber.findFirst({
      where: {
        assignedId: userId,
        status: 'ASSIGNED',
      },
    });

    if (userNumber) {
      return userNumber.e164Number;
    }

    return this.configService.get<string>('telephony.defaultCallerId', '+14155550100');
  }

  async listNumbers(filter?: {
    status?: PhoneNumberStatus;
    assignedId?: string;
  }): Promise<PhoneNumberSummary[]> {
    const where: any = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.assignedId) where.assignedId = filter.assignedId;

    const records = await this.prisma.phoneNumber.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.mapToSummary(r));
  }

  async getNumberById(id: string): Promise<PhoneNumberSummary> {
    const record = await this.prisma.phoneNumber.findUnique({
      where: { id },
    });
    if (!record) throw new NotFoundException(`Phone number ${id} not found`);
    return this.mapToSummary(record);
  }

  async findByE164(e164: string): Promise<PhoneNumberSummary | null> {
    const record = await this.prisma.phoneNumber.findUnique({
      where: { e164Number: e164 },
    });
    return record ? this.mapToSummary(record) : null;
  }

  private mapToSummary(record: any): PhoneNumberSummary {
    let capabilities: string[] = [];
    try {
      capabilities = JSON.parse(record.capabilitiesJson || '[]');
    } catch {
      capabilities = [];
    }

    return {
      id: record.id,
      e164Number: record.e164Number,
      displayNumber: record.displayNumber,
      countryCode: record.countryCode,
      type: record.type as unknown as PhoneNumberType,
      status: record.status as unknown as PhoneNumberStatus,
      provider: record.provider,
      providerResourceId: record.providerResourceId || undefined,
      assignedType: record.assignedType ? (record.assignedType as unknown as PhoneNumberAssignmentType) : undefined,
      assignedId: record.assignedId || undefined,
      capabilities,
      createdAt: record.createdAt.toISOString(),
      releasedAt: record.releasedAt ? record.releasedAt.toISOString() : undefined,
    };
  }
}
