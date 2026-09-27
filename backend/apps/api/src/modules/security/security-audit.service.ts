import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service';

export interface SecurityEventInput {
  actorId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  result: 'SUCCESS' | 'FAILURE' | 'DENIED';
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class SecurityAuditService {
  private readonly logger = new StructuredLogger('SecurityAudit');

  constructor(private readonly prisma: PrismaService) {}

  async logEvent(event: SecurityEventInput): Promise<void> {
    // 1. Structured log for SIEM / external log shippers (secrets stripped)
    this.logger.log({
      type: 'SECURITY_AUDIT_EVENT',
      ...event,
      timestamp: new Date().toISOString(),
    });

    // 2. Persist to database if database connection is available
    try {
      if (this.prisma.isDatabaseConnected()) {
        await this.prisma.securityEvent.create({
          data: {
            actorId: event.actorId,
            action: event.action,
            targetType: event.targetType,
            targetId: event.targetId,
            result: event.result,
            reason: event.reason,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            correlationId: event.correlationId,
            metadataJson: JSON.stringify(event.metadata || {}),
          },
        });
      }
    } catch (err) {
      this.logger.warn({
        message: 'Failed to persist security audit event to database',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async getRecentEvents(limit = 50, actorId?: string) {
    if (!this.prisma.isDatabaseConnected()) {
      return [];
    }
    return this.prisma.securityEvent.findMany({
      where: actorId ? { actorId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }
}
