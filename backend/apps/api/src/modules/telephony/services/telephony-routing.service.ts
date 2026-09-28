import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RoutingRuleSummary, RoutingTargetType } from '@nexavoice/domain-types';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

export interface CreateRoutingRuleDto {
  phoneNumberId: string;
  name: string;
  priority?: number;
  targetType: RoutingTargetType;
  targetId?: string;
  fallbackTargetType?: RoutingTargetType;
  fallbackTargetId?: string;
  ringDurationSeconds?: number;
  businessHoursOnly?: boolean;
}

export interface ResolvedInboundRoute {
  targetType: RoutingTargetType;
  targetId?: string;
  fallbackTargetType?: RoutingTargetType;
  fallbackTargetId?: string;
  ringDurationSeconds: number;
  ruleName: string;
}

@Injectable()
export class TelephonyRoutingService {
  private readonly logger = new StructuredLogger('TelephonyRoutingService');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves the target destination for an inbound call to a dialed DID (e164Number).
   * Evaluates rules deterministically by priority, checking business hours and fallbacks.
   */
  async resolveInboundRoute(e164Number: string): Promise<ResolvedInboundRoute> {
    const phoneNumber = await this.prisma.phoneNumber.findUnique({
      where: { e164Number },
      include: {
        routingRules: {
          where: { enabled: true },
          orderBy: { priority: 'asc' },
        },
      },
    });

    if (!phoneNumber) {
      this.logger.warn({
        event: 'inbound_route_unknown_did',
        e164Number,
      });
      return {
        targetType: RoutingTargetType.REJECT,
        ringDurationSeconds: 0,
        ruleName: 'Default Unassigned DID Reject',
      };
    }

    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentDay = now.getUTCDay(); // 0 is Sunday, 6 is Saturday
    const isBusinessHours = currentDay >= 1 && currentDay <= 5 && currentHour >= 9 && currentHour < 18;

    // 1. Evaluate explicit routing rules in ascending priority order
    for (const rule of phoneNumber.routingRules) {
      if (rule.businessHoursOnly && !isBusinessHours) {
        // Outside business hours, jump straight to fallback if configured
        if (rule.fallbackTargetType) {
          return {
            targetType: rule.fallbackTargetType as unknown as RoutingTargetType,
            targetId: rule.fallbackTargetId || undefined,
            ringDurationSeconds: rule.ringDurationSeconds,
            ruleName: `${rule.name} (After-Hours Fallback)`,
          };
        }
        continue;
      }

      return {
        targetType: rule.targetType as unknown as RoutingTargetType,
        targetId: rule.targetId || undefined,
        fallbackTargetType: rule.fallbackTargetType
          ? (rule.fallbackTargetType as unknown as RoutingTargetType)
          : undefined,
        fallbackTargetId: rule.fallbackTargetId || undefined,
        ringDurationSeconds: rule.ringDurationSeconds,
        ruleName: rule.name,
      };
    }

    // 2. Default route based on number assignment if no specific rule matched
    if (phoneNumber.assignedType === 'USER' && phoneNumber.assignedId) {
      return {
        targetType: RoutingTargetType.USER,
        targetId: phoneNumber.assignedId,
        fallbackTargetType: RoutingTargetType.VOICEMAIL,
        fallbackTargetId: phoneNumber.assignedId,
        ringDurationSeconds: 20,
        ruleName: 'Default User Assignment Route',
      };
    }

    if (phoneNumber.assignedType === 'ROOM' && phoneNumber.assignedId) {
      return {
        targetType: RoutingTargetType.ROOM,
        targetId: phoneNumber.assignedId,
        ringDurationSeconds: 30,
        ruleName: 'Default Room Assignment Route',
      };
    }

    // 3. Fallback reject
    return {
      targetType: RoutingTargetType.REJECT,
      ringDurationSeconds: 0,
      ruleName: 'Default No-Match Fallback',
    };
  }

  async createRule(input: CreateRoutingRuleDto): Promise<RoutingRuleSummary> {
    const phoneNumber = await this.prisma.phoneNumber.findUnique({
      where: { id: input.phoneNumberId },
    });
    if (!phoneNumber) {
      throw new NotFoundException(`Phone number ${input.phoneNumberId} not found`);
    }

    const rule = await this.prisma.routingRule.create({
      data: {
        phoneNumberId: input.phoneNumberId,
        name: input.name,
        priority: input.priority || 1,
        targetType: input.targetType as any,
        targetId: input.targetId,
        fallbackTargetType: input.fallbackTargetType as any,
        fallbackTargetId: input.fallbackTargetId,
        ringDurationSeconds: input.ringDurationSeconds || 20,
        businessHoursOnly: input.businessHoursOnly || false,
        enabled: true,
      },
    });

    return this.mapToSummary(rule);
  }

  async updateRule(
    ruleId: string,
    updates: Partial<CreateRoutingRuleDto> & { enabled?: boolean },
  ): Promise<RoutingRuleSummary> {
    const rule = await this.prisma.routingRule.findUnique({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException(`Routing rule ${ruleId} not found`);

    const updated = await this.prisma.routingRule.update({
      where: { id: ruleId },
      data: {
        name: updates.name,
        priority: updates.priority,
        targetType: updates.targetType as any,
        targetId: updates.targetId,
        fallbackTargetType: updates.fallbackTargetType as any,
        fallbackTargetId: updates.fallbackTargetId,
        ringDurationSeconds: updates.ringDurationSeconds,
        businessHoursOnly: updates.businessHoursOnly,
        enabled: updates.enabled,
      },
    });

    return this.mapToSummary(updated);
  }

  async deleteRule(ruleId: string): Promise<void> {
    const rule = await this.prisma.routingRule.findUnique({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException(`Routing rule ${ruleId} not found`);
    await this.prisma.routingRule.delete({ where: { id: ruleId } });
  }

  async listRules(phoneNumberId: string): Promise<RoutingRuleSummary[]> {
    const rules = await this.prisma.routingRule.findMany({
      where: { phoneNumberId },
      orderBy: { priority: 'asc' },
    });
    return rules.map((r) => this.mapToSummary(r));
  }

  private mapToSummary(rule: any): RoutingRuleSummary {
    return {
      id: rule.id,
      phoneNumberId: rule.phoneNumberId,
      name: rule.name,
      priority: rule.priority,
      targetType: rule.targetType as unknown as RoutingTargetType,
      targetId: rule.targetId || undefined,
      fallbackTargetType: rule.fallbackTargetType
        ? (rule.fallbackTargetType as unknown as RoutingTargetType)
        : undefined,
      fallbackTargetId: rule.fallbackTargetId || undefined,
      ringDurationSeconds: rule.ringDurationSeconds,
      businessHoursOnly: rule.businessHoursOnly,
      enabled: rule.enabled,
      createdAt: rule.createdAt.toISOString(),
    };
  }
}
