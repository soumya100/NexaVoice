import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { SignalingGateway } from '../realtime/signaling.gateway';
import { CallStateMachineService } from '../calling/services/call-state-machine.service';

import { PhoneNumberNormalizerService } from './services/phone-number-normalizer.service';
import { TollFraudProtectionService } from './services/toll-fraud-protection.service';
import { MockTelephonyProvider } from './providers/mock-telephony.provider';
import { TwilioTelephonyProvider } from './providers/twilio-telephony.provider';
import { TelnyxTelephonyProvider } from './providers/telnyx-telephony.provider';
import { PhoneNumberService } from './services/phone-number.service';
import { TelephonyRoutingService } from './services/telephony-routing.service';
import { VoicemailService } from './services/voicemail.service';
import { TelephonyService } from './services/telephony.service';
import {
  PhoneNumberAssignmentType,
  PhoneNumberStatus,
  RoutingTargetType,
} from '@nexavoice/domain-types';

describe('Milestone 6: PSTN, SIP & Telephony Subsystem', () => {
  let normalizer: PhoneNumberNormalizerService;
  let fraudProtection: TollFraudProtectionService;
  let mockProvider: MockTelephonyProvider;
  let twilioProvider: TwilioTelephonyProvider;
  let telnyxProvider: TelnyxTelephonyProvider;
  let numberService: PhoneNumberService;
  let routingService: TelephonyRoutingService;
  let voicemailService: VoicemailService;
  let telephonyService: TelephonyService;

  let mockPrisma: any;
  let mockSecurityAudit: any;
  let mockSignalingGateway: any;
  let mockStateMachine: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockSecurityAudit = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockSignalingGateway = {
      broadcastToUser: jest.fn(),
      broadcastToCall: jest.fn(),
    };

    mockStateMachine = {
      transitionCallSession: jest.fn().mockResolvedValue({ id: 'call-1', status: 'RINGING' }),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'telephony.provider') return 'mock';
        if (key === 'telephony.defaultCallerId') return '+14155550100';
        return defaultVal;
      }),
    };

    // In-memory mock database state for tests
    const inMemoryNumbers = new Map<string, any>();
    const inMemoryRules = new Map<string, any>();
    const inMemoryVoicemails = new Map<string, any>();
    const inMemoryUsage = new Map<string, any>();
    const inMemoryEvents = new Map<string, any>();

    mockPrisma = {
      $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
      phoneNumber: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const record = { id: `num-${Date.now()}`, ...data, createdAt: new Date(), updatedAt: new Date() };
          inMemoryNumbers.set(record.id, record);
          inMemoryNumbers.set(record.e164Number, record);
          return record;
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          if (where.id) return inMemoryNumbers.get(where.id) || null;
          if (where.e164Number) return inMemoryNumbers.get(where.e164Number) || null;
          return null;
        }),
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          for (const item of inMemoryNumbers.values()) {
            if (where.assignedId && item.assignedId === where.assignedId) return item;
          }
          return null;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }: any) => {
          const existing = inMemoryNumbers.get(where.id);
          if (!existing) throw new Error('Not found');
          const updated = { ...existing, ...data, updatedAt: new Date() };
          inMemoryNumbers.set(where.id, updated);
          return updated;
        }),
        findMany: jest.fn().mockImplementation(async () => Array.from(inMemoryNumbers.values())),
      },
      routingRule: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const rule = { id: `rule-${Date.now()}`, ...data, createdAt: new Date(), updatedAt: new Date() };
          inMemoryRules.set(rule.id, rule);
          return rule;
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => inMemoryRules.get(where.id) || null),
        findMany: jest.fn().mockImplementation(async () => Array.from(inMemoryRules.values())),
        delete: jest.fn().mockImplementation(async ({ where }: any) => inMemoryRules.delete(where.id)),
      },
      voicemailMessage: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const vm = { id: `vm-${Date.now()}`, ...data, createdAt: new Date(), updatedAt: new Date() };
          inMemoryVoicemails.set(vm.id, vm);
          return vm;
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => inMemoryVoicemails.get(where.id) || null),
        update: jest.fn().mockImplementation(async ({ where, data }: any) => {
          const vm = inMemoryVoicemails.get(where.id);
          const updated = { ...vm, ...data, updatedAt: new Date() };
          inMemoryVoicemails.set(where.id, updated);
          return updated;
        }),
        findMany: jest.fn().mockImplementation(async () => Array.from(inMemoryVoicemails.values())),
      },
      telephonyUsage: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const usage = { id: `usage-${Date.now()}`, ...data, startedAt: new Date() };
          inMemoryUsage.set(usage.id, usage);
          return usage;
        }),
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          for (const item of inMemoryUsage.values()) {
            if (where.providerCallId && item.providerCallId === where.providerCallId) return item;
          }
          return null;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }: any) => {
          const item = inMemoryUsage.get(where.id);
          const updated = { ...item, ...data };
          inMemoryUsage.set(where.id, updated);
          return updated;
        }),
        findMany: jest.fn().mockImplementation(async () => Array.from(inMemoryUsage.values())),
      },
      providerEvent: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          const key = `${where.provider_providerEventId?.provider}:${where.provider_providerEventId?.providerEventId}`;
          return inMemoryEvents.get(key) || null;
        }),
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const key = `${data.provider}:${data.providerEventId}`;
          inMemoryEvents.set(key, data);
          return data;
        }),
      },
      callSession: {
        create: jest.fn().mockResolvedValue({ id: 'call-pstn-1', status: 'INITIATING', hostUserId: 'user-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'call-pstn-1', status: 'ACTIVE', hostUserId: 'user-1', participants: [{ userId: 'user-1' }], telephonyUsage: [{ providerCallId: 'mock-call-1' }] }),
      },
      callParticipant: {
        create: jest.fn().mockResolvedValue({ id: 'part-1', userId: 'user-1' }),
      },
      callLeg: {
        create: jest.fn().mockResolvedValue({ id: 'leg-1', status: 'RINGING' }),
        count: jest.fn().mockResolvedValue(0),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1', displayName: 'Alice' }),
      },
      callRoom: {
        findUnique: jest.fn().mockResolvedValue({ id: 'room-1', name: 'Conference Room' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhoneNumberNormalizerService,
        TollFraudProtectionService,
        MockTelephonyProvider,
        TwilioTelephonyProvider,
        TelnyxTelephonyProvider,
        PhoneNumberService,
        TelephonyRoutingService,
        VoicemailService,
        TelephonyService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SecurityAuditService, useValue: mockSecurityAudit },
        { provide: SignalingGateway, useValue: mockSignalingGateway },
        { provide: CallStateMachineService, useValue: mockStateMachine },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    normalizer = module.get<PhoneNumberNormalizerService>(PhoneNumberNormalizerService);
    fraudProtection = module.get<TollFraudProtectionService>(TollFraudProtectionService);
    mockProvider = module.get<MockTelephonyProvider>(MockTelephonyProvider);
    twilioProvider = module.get<TwilioTelephonyProvider>(TwilioTelephonyProvider);
    telnyxProvider = module.get<TelnyxTelephonyProvider>(TelnyxTelephonyProvider);
    numberService = module.get<PhoneNumberService>(PhoneNumberService);
    routingService = module.get<TelephonyRoutingService>(TelephonyRoutingService);
    voicemailService = module.get<VoicemailService>(VoicemailService);
    telephonyService = module.get<TelephonyService>(TelephonyService);
  });

  // ==========================================
  // 0. PROVIDER ADAPTER CONTRACTS
  // ==========================================
  describe('Telephony Providers & Adapter Contracts', () => {
    it('validates MockTelephonyProvider capabilities and webhook verification', async () => {
      expect(mockProvider.providerName).toBe('mock');
      expect(mockProvider.capabilities.outboundCalling).toBe(true);
      expect(mockProvider.capabilities.inboundCalling).toBe(true);
      expect(mockProvider.capabilities.dtmf).toBe(true);

      const validVerification = await mockProvider.verifyWebhook(
        { 'x-mock-telephony-secret': 'valid-mock-secret' },
        '{}',
        'http://localhost',
      );
      expect(validVerification.isValid).toBe(true);

      const invalidVerification = await mockProvider.verifyWebhook(
        { 'x-mock-telephony-secret': 'wrong-secret' },
        '{}',
        'http://localhost',
      );
      expect(invalidVerification.isValid).toBe(false);
    });

    it('validates TwilioTelephonyProvider capabilities and signature verification handling', async () => {
      expect(twilioProvider.providerName).toBe('twilio');
      expect(twilioProvider.capabilities.outboundCalling).toBe(true);
      expect(twilioProvider.capabilities.sipTrunking).toBe(true);

      // Without auth token configured, signature verification fails safely
      const verifyResult = await twilioProvider.verifyWebhook(
        { 'x-twilio-signature': 'forged_sig' },
        'CallSid=CA12345&CallStatus=ringing',
        'https://api.nexavoice.com/api/v1/telephony/webhooks/twilio',
      );
      expect(verifyResult.isValid).toBe(false);
    });

    it('validates TelnyxTelephonyProvider capabilities and ed25519 signature handling', async () => {
      expect(telnyxProvider.providerName).toBe('telnyx');
      expect(telnyxProvider.capabilities.outboundCalling).toBe(true);
      expect(telnyxProvider.capabilities.sipTrunking).toBe(true);

      // Without public key configured, signature verification fails safely
      const verifyResult = await telnyxProvider.verifyWebhook(
        { 'telnyx-signature-ed25519': 'bad_sig', 'telnyx-timestamp': '1234567890' },
        '{"data":{"event_type":"call.initiated"}}',
        'https://api.nexavoice.com/api/v1/telephony/webhooks/telnyx',
      );
      expect(verifyResult.isValid).toBe(false);
    });
  });
  // 1. E.164 NORMALIZATION & CLASSIFICATION
  // ==========================================
  describe('PhoneNumberNormalizerService', () => {
    it('normalizes standard US numbers with formatting into canonical E.164 and display strings', () => {
      const result = normalizer.normalize('(415) 555-2671', 'US');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+14155552671');
      expect(result.display).toBe('+1 (415) 555-2671');
      expect(result.countryCode).toBe('US');
      expect(result.isEmergency).toBe(false);
      expect(result.isTollFree).toBe(false);
    });

    it('normalizes international UK phone numbers with national zero prefix', () => {
      const result = normalizer.normalize('020 7946 0912', 'GB');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+442079460912');
      expect(result.countryCode).toBe('GB');
    });

    it('identifies emergency numbers (911, 112, 999)', () => {
      const us911 = normalizer.normalize('911', 'US');
      expect(us911.isEmergency).toBe(true);
      expect(us911.isValid).toBe(true);

      const uk999 = normalizer.normalize('999', 'GB');
      expect(uk999.isEmergency).toBe(true);
    });

    it('identifies US toll-free numbers (800, 888, 877, etc.)', () => {
      const tollFree = normalizer.normalize('+1 (800) 555-0199', 'US');
      expect(tollFree.isValid).toBe(true);
      expect(tollFree.isTollFree).toBe(true);
    });

    it('identifies high-risk premium destinations (e.g., 900 numbers, satellite)', () => {
      const premium = normalizer.normalize('+1 (900) 555-0199', 'US');
      expect(premium.isHighRiskPremium).toBe(true);

      const satellite = normalizer.normalize('+870773123456');
      expect(satellite.isHighRiskPremium).toBe(true);
    });
  });

  // ==========================================
  // 2. TOLL-FRAUD PROTECTION
  // ==========================================
  describe('TollFraudProtectionService', () => {
    it('blocks calls to high-risk premium destinations', async () => {
      const premiumNumber = normalizer.normalize('+1 (900) 555-0199');
      await expect(fraudProtection.assertCanInitiateCall('user-1', premiumNumber)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('blocks calls to disallowed countries outside organization policy', async () => {
      const disallowedNumber = normalizer.normalize('+5511999999999'); // Brazil (not in default allowlist)
      await expect(fraudProtection.assertCanInitiateCall('user-1', disallowedNumber)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('enforces per-minute call rate limiting', async () => {
      fraudProtection.resetRateLimits();
      const validNumber = normalizer.normalize('+14155550100');

      // Trigger 10 calls (allowed limit)
      for (let i = 0; i < 10; i++) {
        await fraudProtection.assertCanInitiateCall('rate-limit-user', validNumber);
      }

      // 11th call exceeds rate limit
      await expect(
        fraudProtection.assertCanInitiateCall('rate-limit-user', validNumber),
      ).rejects.toThrow('Call rate limit exceeded');
    });

    it('enforces concurrent PSTN call limit per user', async () => {
      fraudProtection.resetRateLimits();
      mockPrisma.callLeg.count.mockResolvedValueOnce(1); // User already has 1 active leg

      const validNumber = normalizer.normalize('+14155550100');
      await expect(fraudProtection.assertCanInitiateCall('busy-user', validNumber)).rejects.toThrow(
        'Concurrent outbound PSTN calls are limited',
      );
    });
  });

  // ==========================================
  // 3. PHONE NUMBER LIFECYCLE & ASSIGNMENT
  // ==========================================
  describe('PhoneNumberService', () => {
    it('provisions a number from active carrier and records audit log', async () => {
      const result = await numberService.provisionNumber('admin-1', {
        countryCode: 'US',
        areaCode: '415',
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe(PhoneNumberStatus.ACTIVE);
      expect(result.countryCode).toBe('US');
      expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PHONE_NUMBER_PROVISIONED',
          actorId: 'admin-1',
          result: 'SUCCESS',
        }),
      );
    });

    it('transactionally assigns an active number to a user', async () => {
      const provisioned = await numberService.provisionNumber('admin-1', { countryCode: 'US' });

      const assigned = await numberService.assignNumber('admin-1', provisioned.id, {
        targetType: PhoneNumberAssignmentType.USER,
        targetId: 'user-1',
      });

      expect(assigned.status).toBe(PhoneNumberStatus.ASSIGNED);
      expect(assigned.assignedType).toBe(PhoneNumberAssignmentType.USER);
      expect(assigned.assignedId).toBe('user-1');
      expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PHONE_NUMBER_ASSIGNED',
        }),
      );
    });

    it('unassigns an assigned number back to active pool', async () => {
      const provisioned = await numberService.provisionNumber('admin-1', { countryCode: 'US' });
      await numberService.assignNumber('admin-1', provisioned.id, {
        targetType: PhoneNumberAssignmentType.USER,
        targetId: 'user-1',
      });

      const unassigned = await numberService.unassignNumber('admin-1', provisioned.id);
      expect(unassigned.status).toBe(PhoneNumberStatus.ACTIVE);
      expect(unassigned.assignedId).toBeUndefined();
    });

    it('releases a number and prevents releasing when active calls exist', async () => {
      const provisioned = await numberService.provisionNumber('admin-1', { countryCode: 'US' });

      // Mock active usage record blocking release
      mockPrisma.phoneNumber.findUnique.mockResolvedValueOnce({
        id: provisioned.id,
        status: 'ACTIVE',
        usageRecords: [{ id: 'active-call-usage' }],
      });

      await expect(numberService.releaseNumber('admin-1', provisioned.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('resolves caller ID prioritizing assigned number before default fallback', async () => {
      // User with assigned number
      mockPrisma.phoneNumber.findFirst.mockResolvedValueOnce({
        e164Number: '+14155559999',
      });
      const resolved = await numberService.resolveCallerId('user-vip');
      expect(resolved).toBe('+14155559999');

      // User without assigned number uses default fallback
      mockPrisma.phoneNumber.findFirst.mockResolvedValueOnce(null);
      const fallback = await numberService.resolveCallerId('user-standard');
      expect(fallback).toBe('+14155550100');
    });
  });

  // ==========================================
  // 4. INBOUND ROUTING SERVICE
  // ==========================================
  describe('TelephonyRoutingService', () => {
    it('creates and evaluates routing rules for incoming DIDs', async () => {
      const provisioned = await numberService.provisionNumber('admin-1', { countryCode: 'US' });

      await routingService.createRule({
        phoneNumberId: provisioned.id,
        name: 'VIP User Direct Ring',
        priority: 1,
        targetType: RoutingTargetType.USER,
        targetId: 'user-1',
        ringDurationSeconds: 15,
      });

      // Mock finding phone number with routing rules
      mockPrisma.phoneNumber.findUnique.mockResolvedValueOnce({
        id: provisioned.id,
        e164Number: provisioned.e164Number,
        routingRules: [
          {
            name: 'VIP User Direct Ring',
            priority: 1,
            targetType: 'USER',
            targetId: 'user-1',
            ringDurationSeconds: 15,
            businessHoursOnly: false,
          },
        ],
      });

      const route = await routingService.resolveInboundRoute(provisioned.e164Number);
      expect(route.targetType).toBe(RoutingTargetType.USER);
      expect(route.targetId).toBe('user-1');
      expect(route.ringDurationSeconds).toBe(15);
    });

    it('rejects unknown or unprovisioned incoming DIDs', async () => {
      mockPrisma.phoneNumber.findUnique.mockResolvedValueOnce(null);
      const route = await routingService.resolveInboundRoute('+19999999999');
      expect(route.targetType).toBe(RoutingTargetType.REJECT);
    });
  });

  // ==========================================
  // 5. VOICEMAIL SUBSYSTEM
  // ==========================================
  describe('VoicemailService', () => {
    it('creates a voicemail linked to CallSession with status UNREAD', async () => {
      const vm = await voicemailService.createVoicemail({
        callSessionId: 'call-pstn-1',
        callerNumber: '+14155550199',
        recipientUserId: 'user-1',
        durationSeconds: 24,
        transcript: 'Hi Alice, please call me back regarding the voice integration.',
      });

      expect(vm.id).toBeDefined();
      expect(vm.callerNumber).toBe('+14155550199');
      expect(vm.status).toBe('UNREAD');
      expect(vm.transcript).toContain('Hi Alice');
      expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'VOICEMAIL_MESSAGE_CREATED',
        }),
      );
    });

    it('enforces IDOR protection: prevents unauthorized users from accessing other users voicemails', async () => {
      const vm = await voicemailService.createVoicemail({
        callSessionId: 'call-pstn-1',
        callerNumber: '+14155550199',
        recipientUserId: 'user-1',
        durationSeconds: 10,
      });

      // Attacker tries to read Alice's voicemail
      await expect(voicemailService.markAsRead('attacker-user', vm.id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ==========================================
  // 6. MASTER TELEPHONY SERVICE & OUTBOUND CALL
  // ==========================================
  describe('TelephonyService', () => {
    it('initiates an outbound PSTN call within unified CallSession/CallLeg domain', async () => {
      fraudProtection.resetRateLimits();

      const result = await telephonyService.initiateOutboundPstnCall('user-1', {
        to: '+1 (415) 555-2671',
      });

      expect(result.callId).toBeDefined();
      expect(result.destinationNumber).toBe('+14155552671');
      expect(result.status).toBe('initiated');

      expect(mockStateMachine.transitionCallSession).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        'RINGING',
      );

      expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'OUTBOUND_PSTN_CALL_INITIATED',
          result: 'SUCCESS',
        }),
      );
    });

    it('blocks emergency numbers with provider-dependent exception', async () => {
      await expect(
        telephonyService.initiateOutboundPstnCall('user-1', { to: '911' }),
      ).rejects.toThrow('Emergency calling (911/112/999) requires live carrier regulatory E911 configuration');
    });

    it('processes verified provider webhooks idempotently and rejects duplicates', async () => {
      const mockRawPayload = JSON.stringify({
        eventId: 'evt-unique-12345',
        eventType: 'call.ringing',
        providerCallId: 'mock-call-1',
        from: '+14155550100',
        to: '+14155550200',
      });

      // 1. First event delivery -> processes successfully
      const firstResult = await telephonyService.processProviderEvent(
        'mock',
        { 'x-mock-telephony-secret': 'valid-mock-secret' },
        mockRawPayload,
        'http://localhost:4000/api/v1/telephony/webhooks/mock',
      );
      expect(firstResult.success).toBe(true);
      expect(firstResult.duplicate).toBeUndefined();

      // 2. Second event delivery with same eventId -> safely recognized as duplicate and not reprocessed
      const secondResult = await telephonyService.processProviderEvent(
        'mock',
        { 'x-mock-telephony-secret': 'valid-mock-secret' },
        mockRawPayload,
        'http://localhost:4000/api/v1/telephony/webhooks/mock',
      );
      expect(secondResult.success).toBe(true);
      expect(secondResult.duplicate).toBe(true);
    });

    it('transmits DTMF digits and broadcasts realtime event', async () => {
      await telephonyService.sendDtmf('user-1', 'call-pstn-1', '1234#');

      expect(mockSignalingGateway.broadcastToCall).toHaveBeenCalledWith(
        'call-pstn-1',
        'call.dtmf.sent',
        expect.objectContaining({
          digits: '1234#',
        }),
      );
    });
  });
});
