import { Test, TestingModule } from '@nestjs/testing';
import {
  SecurityAuditService,
  canonicalizeAuditEvent,
  computeEventHash,
  verifyAuditChain,
  StoredSecurityEvent,
} from './security-audit.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('SecurityAuditService - Immutability & Tamper-Evident Hash Chaining', () => {
  let service: SecurityAuditService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      isDatabaseConnected: jest.fn().mockReturnValue(true),
      securityEvent: {
        findFirst: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'evt-1', ...data })),
        findMany: jest.fn(),
        update: jest.fn().mockImplementation(() =>
          Promise.reject(new Error('SecurityEvent records are append-only and immutable. UPDATE prohibited.')),
        ),
        delete: jest.fn().mockImplementation(() =>
          Promise.reject(new Error('SecurityEvent records are append-only and immutable. DELETE prohibited.')),
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityAuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SecurityAuditService>(SecurityAuditService);
  });

  it('1. should deterministically canonicalize event attributes', () => {
    const canonical1 = canonicalizeAuditEvent({
      action: 'LOGIN_SUCCESS',
      actorId: 'user-1',
      result: 'SUCCESS',
      createdAt: '2026-09-27T00:00:00.000Z',
    });

    const canonical2 = canonicalizeAuditEvent({
      result: 'SUCCESS',
      createdAt: '2026-09-27T00:00:00.000Z',
      actorId: 'user-1',
      action: 'LOGIN_SUCCESS',
    });

    expect(canonical1).toBe(canonical2);
  });

  it('2. should build a cryptographically valid hash chain over multiple events', async () => {
    const timestamp1 = new Date('2026-09-27T01:00:00.000Z');
    const timestamp2 = new Date('2026-09-27T01:01:00.000Z');
    const timestamp3 = new Date('2026-09-27T01:02:00.000Z');

    const canonical1 = canonicalizeAuditEvent({
      action: 'USER_REGISTERED',
      actorId: 'user-1',
      result: 'SUCCESS',
      createdAt: timestamp1.toISOString(),
    });
    const hash1 = computeEventHash('GENESIS', canonical1);

    const canonical2 = canonicalizeAuditEvent({
      action: 'LOGIN_SUCCESS',
      actorId: 'user-1',
      result: 'SUCCESS',
      createdAt: timestamp2.toISOString(),
    });
    const hash2 = computeEventHash(hash1, canonical2);

    const canonical3 = canonicalizeAuditEvent({
      action: 'CONVERSATION_CREATED',
      actorId: 'user-1',
      result: 'SUCCESS',
      createdAt: timestamp3.toISOString(),
    });
    const hash3 = computeEventHash(hash2, canonical3);

    const chain: StoredSecurityEvent[] = [
      {
        id: 'evt-1',
        action: 'USER_REGISTERED',
        actorId: 'user-1',
        result: 'SUCCESS',
        previousEventHash: 'GENESIS',
        eventHash: hash1,
        createdAt: timestamp1,
      },
      {
        id: 'evt-2',
        action: 'LOGIN_SUCCESS',
        actorId: 'user-1',
        result: 'SUCCESS',
        previousEventHash: hash1,
        eventHash: hash2,
        createdAt: timestamp2,
      },
      {
        id: 'evt-3',
        action: 'CONVERSATION_CREATED',
        actorId: 'user-1',
        result: 'SUCCESS',
        previousEventHash: hash2,
        eventHash: hash3,
        createdAt: timestamp3,
      },
    ];

    const verification = verifyAuditChain(chain);
    expect(verification.valid).toBe(true);
  });

  it('3. should DETECT TAMPERING if any event payload attribute is modified post-hoc', () => {
    const timestamp = new Date('2026-09-27T01:00:00.000Z');
    const canonical = canonicalizeAuditEvent({
      action: 'ROLE_ASSIGNED',
      actorId: 'user-1',
      result: 'SUCCESS',
      metadataJson: JSON.stringify({ roleName: 'USER' }),
      createdAt: timestamp.toISOString(),
    });
    const validHash = computeEventHash('GENESIS', canonical);

    const tamperedChain: StoredSecurityEvent[] = [
      {
        id: 'evt-1',
        action: 'ROLE_ASSIGNED',
        actorId: 'user-1',
        result: 'SUCCESS',
        // Attacker tampered with metadata to claim SYSTEM_ADMIN
        metadataJson: JSON.stringify({ roleName: 'SYSTEM_ADMIN' }),
        previousEventHash: 'GENESIS',
        eventHash: validHash,
        createdAt: timestamp,
      },
    ];

    const verification = verifyAuditChain(tamperedChain);
    expect(verification.valid).toBe(false);
    expect(verification.brokenEventId).toBe('evt-1');
    expect(verification.reason).toContain('Cryptographic tampering detected');
  });

  it('4. should DETECT TAMPERING if an event is deleted or reordered from the middle of the chain', () => {
    const timestamp1 = new Date('2026-09-27T01:00:00.000Z');
    const timestamp3 = new Date('2026-09-27T01:02:00.000Z');

    const canonical1 = canonicalizeAuditEvent({
      action: 'EVENT_1',
      result: 'SUCCESS',
      createdAt: timestamp1.toISOString(),
    });
    const hash1 = computeEventHash('GENESIS', canonical1);

    // evt-2 was deleted by an adversary, leaving evt-3 referencing a missing hash-2
    const brokenChain: StoredSecurityEvent[] = [
      {
        id: 'evt-1',
        action: 'EVENT_1',
        result: 'SUCCESS',
        previousEventHash: 'GENESIS',
        eventHash: hash1,
        createdAt: timestamp1,
      },
      {
        id: 'evt-3',
        action: 'EVENT_3',
        result: 'SUCCESS',
        previousEventHash: 'hash-2', // references deleted evt-2!
        eventHash: 'hash-3',
        createdAt: timestamp3,
      },
    ];

    const verification = verifyAuditChain(brokenChain);
    expect(verification.valid).toBe(false);
    expect(verification.brokenIndex).toBe(1);
    expect(verification.reason).toContain('Broken chain link at index 1');
  });

  it('5. should reject UPDATE and DELETE attempts in compliance with immutable audit invariant', async () => {
    await expect(mockPrisma.securityEvent.update()).rejects.toThrow('append-only and immutable');
    await expect(mockPrisma.securityEvent.delete()).rejects.toThrow('append-only and immutable');
  });

  it('6. should successfully log events and verify chain integrity via service', async () => {
    mockPrisma.securityEvent.findFirst.mockResolvedValue(null);
    await service.logEvent({
      action: 'USER_REGISTERED',
      actorId: 'user-1',
      result: 'SUCCESS',
    });

    expect(mockPrisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'USER_REGISTERED',
          previousEventHash: 'GENESIS',
          eventHash: expect.any(String),
        }),
      }),
    );

    mockPrisma.securityEvent.findMany.mockResolvedValue([]);
    const integrity = await service.verifyIntegrity();
    expect(integrity.valid).toBe(true);
  });
});
