import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AIIntelligenceService } from '../services/ai-intelligence.service';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

@Injectable()
export class AIWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new StructuredLogger('AIWorker');
  private isRunning = false;
  private intervalRef?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligenceService: AIIntelligenceService,
  ) {}

  onModuleInit() {
    this.startWorker();
  }

  onModuleDestroy() {
    this.stopWorker();
  }

  startWorker() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger.log({ event: 'ai_worker_started', pollIntervalMs: 5000 });

    this.intervalRef = setInterval(async () => {
      try {
        await this.processPendingJobs();
      } catch (err) {
        this.logger.error({ event: 'ai_worker_error', error: String(err) });
      }
    }, 5000);
  }

  stopWorker() {
    this.isRunning = false;
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = undefined;
    }
    this.logger.log({ event: 'ai_worker_stopped' });
  }

  async processPendingJobs(): Promise<number> {
    // Look for pending outbox events targeting AI processing or ended calls without summaries
    const pendingEvents = await this.prisma.outboxEvent.findMany({
      where: {
        eventType: { in: ['call.ended', 'ai.process.requested'] },
        status: 'PENDING',
      },
      take: 10,
    });

    let processedCount = 0;

    for (const evt of pendingEvents) {
      const callSessionId = evt.aggregateId;

      try {
        // Generate summary asynchronously without blocking live calls
        await this.intelligenceService.generateCallSummary(callSessionId);

        await this.prisma.outboxEvent.update({
          where: { id: evt.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });

        processedCount++;
      } catch (err) {
        this.logger.warn({
          event: 'ai_job_failed_retrying',
          eventId: evt.id,
          callSessionId,
          error: String(err),
        });
      }
    }

    return processedCount;
  }
}
