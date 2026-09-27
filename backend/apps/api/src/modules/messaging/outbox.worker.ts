import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SignalingGateway } from '../realtime/signaling.gateway';
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service';

export interface OutboxPublishResult {
  processedCount: number;
  failedCount: number;
  deadLetterCount: number;
}

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new StructuredLogger('OutboxWorker');
  private pollInterval?: NodeJS.Timeout;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly signalingGateway: SignalingGateway,
  ) {}

  onModuleInit() {
    // Start background poller every 1000ms
    this.pollInterval = setInterval(() => {
      this.drainPendingEvents().catch((err) => {
        this.logger.error({
          message: 'Error during outbox polling tick',
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, 1000);
    if (this.pollInterval.unref) {
      this.pollInterval.unref();
    }
  }

  onModuleDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  /**
   * Drains pending outbox events idempotently and broadcasts them to the appropriate realtime channels.
   */
  async drainPendingEvents(batchSize = 50): Promise<OutboxPublishResult> {
    if (this.isProcessing || !this.prisma.isDatabaseConnected()) {
      return { processedCount: 0, failedCount: 0, deadLetterCount: 0 };
    }

    this.isProcessing = true;
    let processedCount = 0;
    let failedCount = 0;
    let deadLetterCount = 0;

    try {
      const now = new Date();
      const events = await this.prisma.outboxEvent.findMany({
        where: {
          status: 'PENDING',
          availableAt: { lte: now },
        },
        orderBy: { createdAt: 'asc' },
        take: batchSize,
      });

      for (const event of events) {
        try {
          const payload = JSON.parse(event.payloadJson);

          // Idempotent realtime broadcast to conversation room
          if (event.aggregateType === 'Conversation') {
            this.signalingGateway.broadcastToConversation(
              event.aggregateId,
              event.eventType,
              payload,
            );
          } else if (event.aggregateType === 'User') {
            this.signalingGateway.broadcastToUser(
              event.aggregateId,
              event.eventType,
              payload,
            );
          }

          // Mark processed
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: 'PROCESSED',
              processedAt: new Date(),
            },
          });

          processedCount++;
        } catch (err: any) {
          failedCount++;
          const attempts = event.attempts + 1;
          const isDeadLetter = attempts >= event.maxAttempts;

          // Exponential backoff: 2^attempts seconds
          const backoffSeconds = Math.min(Math.pow(2, attempts), 60);
          const nextAvailableAt = new Date(Date.now() + backoffSeconds * 1000);

          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              attempts,
              status: isDeadLetter ? 'DEAD_LETTER' : 'PENDING',
              lastError: err?.message || String(err),
              availableAt: nextAvailableAt,
            },
          });

          if (isDeadLetter) {
            deadLetterCount++;
            this.logger.error({
              message: 'OutboxEvent reached max retries and was moved to DEAD_LETTER',
              eventId: event.id,
              eventType: event.eventType,
              aggregateId: event.aggregateId,
              error: err?.message,
            });
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return { processedCount, failedCount, deadLetterCount };
  }
}
