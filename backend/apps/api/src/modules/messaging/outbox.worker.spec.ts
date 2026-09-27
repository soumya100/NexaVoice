import { Test, TestingModule } from '@nestjs/testing';
import { OutboxWorker } from './outbox.worker';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SignalingGateway } from '../realtime/signaling.gateway';

describe('OutboxWorker - Transactional Outbox & Resilient Publishing', () => {
  let worker: OutboxWorker;
  let mockPrisma: any;
  let mockSignalingGateway: any;

  beforeEach(async () => {
    mockPrisma = {
      isDatabaseConnected: jest.fn().mockReturnValue(true),
      outboxEvent: {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      },
    };

    mockSignalingGateway = {
      broadcastToConversation: jest.fn(),
      broadcastToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxWorker,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SignalingGateway, useValue: mockSignalingGateway },
      ],
    }).compile();

    worker = module.get<OutboxWorker>(OutboxWorker);
  });

  afterEach(() => {
    worker.onModuleDestroy();
  });

  it('1. should process pending event, broadcast to conversation, and mark PROCESSED', async () => {
    const mockEvent = {
      id: 'outbox-1',
      eventType: 'conversation.message.created',
      aggregateType: 'Conversation',
      aggregateId: 'conv-100',
      payloadJson: JSON.stringify({ id: 'msg-1', content: 'Hello reliable world' }),
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 5,
      availableAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
    };

    mockPrisma.outboxEvent.findMany.mockResolvedValue([mockEvent]);

    const result = await worker.drainPendingEvents();

    expect(result.processedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(mockSignalingGateway.broadcastToConversation).toHaveBeenCalledWith(
      'conv-100',
      'conversation.message.created',
      { id: 'msg-1', content: 'Hello reliable world' },
    );
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'outbox-1' },
      data: expect.objectContaining({
        status: 'PROCESSED',
        processedAt: expect.any(Date),
      }),
    });
  });

  it('2. should retry with exponential backoff on publisher failure', async () => {
    const mockEvent = {
      id: 'outbox-fail',
      eventType: 'conversation.message.created',
      aggregateType: 'Conversation',
      aggregateId: 'conv-100',
      payloadJson: JSON.stringify({ id: 'msg-fail' }),
      status: 'PENDING',
      attempts: 1, // Second attempt
      maxAttempts: 5,
      availableAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
    };

    mockPrisma.outboxEvent.findMany.mockResolvedValue([mockEvent]);
    mockSignalingGateway.broadcastToConversation.mockImplementation(() => {
      throw new Error('Redis socket cluster connection error');
    });

    const result = await worker.drainPendingEvents();

    expect(result.processedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.deadLetterCount).toBe(0);
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'outbox-fail' },
      data: expect.objectContaining({
        attempts: 2,
        status: 'PENDING',
        lastError: 'Redis socket cluster connection error',
        availableAt: expect.any(Date),
      }),
    });
  });

  it('3. should move event to DEAD_LETTER after maxAttempts reached', async () => {
    const mockEvent = {
      id: 'outbox-dead',
      eventType: 'conversation.message.created',
      aggregateType: 'Conversation',
      aggregateId: 'conv-100',
      payloadJson: JSON.stringify({ id: 'msg-dead' }),
      status: 'PENDING',
      attempts: 4, // Max attempts is 5, next attempt reaches max!
      maxAttempts: 5,
      availableAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
    };

    mockPrisma.outboxEvent.findMany.mockResolvedValue([mockEvent]);
    mockSignalingGateway.broadcastToConversation.mockImplementation(() => {
      throw new Error('Fatal socket deserialization failure');
    });

    const result = await worker.drainPendingEvents();

    expect(result.failedCount).toBe(1);
    expect(result.deadLetterCount).toBe(1);
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'outbox-dead' },
      data: expect.objectContaining({
        attempts: 5,
        status: 'DEAD_LETTER',
        lastError: 'Fatal socket deserialization failure',
      }),
    });
  });

  it('4. should gracefully return when database is disconnected', async () => {
    mockPrisma.isDatabaseConnected.mockReturnValue(false);

    const result = await worker.drainPendingEvents();
    expect(result.processedCount).toBe(0);
    expect(mockPrisma.outboxEvent.findMany).not.toHaveBeenCalled();
  });
});
