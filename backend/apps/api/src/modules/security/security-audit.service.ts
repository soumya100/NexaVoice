import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
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

export interface StoredSecurityEvent {
  id: string;
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  result: string;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
  metadataJson?: string | null;
  previousEventHash?: string | null;
  eventHash?: string | null;
  createdAt: Date;
}

/**
 * Deterministically canonicalizes audit event data so hash generation is reproducible.
 */
export function canonicalizeAuditEvent(payload: {
  action: string;
  actorId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  result: string;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
  metadataJson?: string | null;
  createdAt: string;
}): string {
  const normalized = {
    action: payload.action,
    actorId: payload.actorId ?? '',
    correlationId: payload.correlationId ?? '',
    createdAt: payload.createdAt,
    ipAddress: payload.ipAddress ?? '',
    metadataJson: payload.metadataJson ?? '{}',
    reason: payload.reason ?? '',
    result: payload.result,
    targetId: payload.targetId ?? '',
    targetType: payload.targetType ?? '',
    userAgent: payload.userAgent ?? '',
  };
  return JSON.stringify(normalized, Object.keys(normalized).sort());
}

/**
 * Computes SHA-256 event hash over previous event hash + canonical payload.
 */
export function computeEventHash(previousHash: string, canonicalPayload: string): string {
  return crypto
    .createHash('sha256')
    .update((previousHash || 'GENESIS') + canonicalPayload)
    .digest('hex');
}

/**
 * Validates the cryptographic integrity of a chain of audit events.
 * Returns true if every hash matches and previousEventHash links are unbroken.
 */
export function verifyAuditChain(events: StoredSecurityEvent[]): {
  valid: boolean;
  brokenIndex?: number;
  brokenEventId?: string;
  reason?: string;
} {
  // Chain must be verified in ascending chronological order
  let prevHash = 'GENESIS';

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    if (event.previousEventHash && event.previousEventHash !== prevHash) {
      return {
        valid: false,
        brokenIndex: i,
        brokenEventId: event.id,
        reason: `Broken chain link at index ${i}: expected previousEventHash ${prevHash}, got ${event.previousEventHash}`,
      };
    }

    const canonical = canonicalizeAuditEvent({
      action: event.action,
      actorId: event.actorId,
      targetType: event.targetType,
      targetId: event.targetId,
      result: event.result,
      reason: event.reason,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      correlationId: event.correlationId,
      metadataJson: event.metadataJson,
      createdAt: event.createdAt instanceof Date ? event.createdAt.toISOString() : String(event.createdAt),
    });

    const expectedHash = computeEventHash(event.previousEventHash || 'GENESIS', canonical);

    if (event.eventHash !== expectedHash) {
      return {
        valid: false,
        brokenIndex: i,
        brokenEventId: event.id,
        reason: `Cryptographic tampering detected at index ${i}: expected eventHash ${expectedHash}, got ${event.eventHash}`,
      };
    }

    prevHash = event.eventHash!;
  }

  return { valid: true };
}

@Injectable()
export class SecurityAuditService {
  private readonly logger = new StructuredLogger('SecurityAudit');

  constructor(private readonly prisma: PrismaService) {}

  async logEvent(event: SecurityEventInput): Promise<StoredSecurityEvent | void> {
    const timestamp = new Date();

    // 1. Structured log for SIEM / external log shippers (secrets stripped)
    this.logger.log({
      type: 'SECURITY_AUDIT_EVENT',
      ...event,
      timestamp: timestamp.toISOString(),
    });

    // 2. Persist to database with cryptographic hash chaining
    try {
      if (this.prisma.isDatabaseConnected()) {
        const metadataJson = JSON.stringify(event.metadata || {});

        // Fetch the most recent event hash to chain onto
        const latestEvent = await this.prisma.securityEvent.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { eventHash: true },
        });

        const previousEventHash = latestEvent?.eventHash || 'GENESIS';

        const canonicalPayload = canonicalizeAuditEvent({
          action: event.action,
          actorId: event.actorId,
          targetType: event.targetType,
          targetId: event.targetId,
          result: event.result,
          reason: event.reason,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          correlationId: event.correlationId,
          metadataJson,
          createdAt: timestamp.toISOString(),
        });

        const eventHash = computeEventHash(previousEventHash, canonicalPayload);

        return await this.prisma.securityEvent.create({
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
            metadataJson,
            previousEventHash,
            eventHash,
            createdAt: timestamp,
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

  async getRecentEvents(limit = 50, actorId?: string): Promise<StoredSecurityEvent[]> {
    if (!this.prisma.isDatabaseConnected()) {
      return [];
    }
    return this.prisma.securityEvent.findMany({
      where: actorId ? { actorId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }

  /**
   * Runs a complete cryptographic audit integrity verification across all persisted events.
   */
  async verifyIntegrity(): Promise<{ valid: boolean; brokenEventId?: string; reason?: string }> {
    if (!this.prisma.isDatabaseConnected()) {
      return { valid: false, reason: 'Database disconnected' };
    }

    const events = await this.prisma.securityEvent.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return verifyAuditChain(events as StoredSecurityEvent[]);
  }
}
