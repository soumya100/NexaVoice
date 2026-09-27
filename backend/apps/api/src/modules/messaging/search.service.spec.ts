import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('SearchService - Scoping & Security Isolation Validation', () => {
  let service: SearchService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      conversationParticipant: {
        findMany: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('1. should NEVER return messages from unauthorized conversations (User A searches, User B conversation is excluded)', async () => {
    // User A belongs ONLY to conv-a
    mockPrisma.conversationParticipant.findMany.mockResolvedValue([{ conversationId: 'conv-a' }]);
    mockPrisma.message.findMany.mockResolvedValue([
      { id: 'msg-1', conversationId: 'conv-a', content: 'keyword found' },
    ]);

    const results = await service.searchMessages('user-a', 'keyword');

    expect(results).toHaveLength(1);
    expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conversationId: { in: ['conv-a'] }, // Strictly scoped to User A's memberships!
          deletedAt: null,
        }),
      }),
    );
  });

  it('2. should reject/ignore search within a conversation ID that caller is NOT a participant of', async () => {
    // User A belongs only to conv-a, but asks to search in conv-secret-b
    mockPrisma.conversationParticipant.findMany.mockResolvedValue([{ conversationId: 'conv-a' }]);

    const results = await service.searchMessages('user-a', 'classified', {
      conversationId: 'conv-secret-b',
    });

    expect(results).toEqual([]);
    expect(mockPrisma.message.findMany).not.toHaveBeenCalled();
  });

  it('3. should exclude soft-deleted messages from search results', async () => {
    mockPrisma.conversationParticipant.findMany.mockResolvedValue([{ conversationId: 'conv-a' }]);
    mockPrisma.message.findMany.mockResolvedValue([]);

    await service.searchMessages('user-a', 'deleted');

    expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null, // Critical requirement: soft-deleted messages never returned
        }),
      }),
    );
  });

  it('4. should return empty array for empty or 1-character queries', async () => {
    const resEmpty = await service.searchMessages('user-a', '   ');
    expect(resEmpty).toEqual([]);

    const resSingle = await service.searchMessages('user-a', 'a');
    expect(resSingle).toEqual([]);
    expect(mockPrisma.conversationParticipant.findMany).not.toHaveBeenCalled();
  });

  it('5. should respect pagination limit parameter', async () => {
    mockPrisma.conversationParticipant.findMany.mockResolvedValue([{ conversationId: 'conv-a' }]);
    mockPrisma.message.findMany.mockResolvedValue([]);

    await service.searchMessages('user-a', 'test search', { limit: 10 });

    expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
      }),
    );
  });
});
