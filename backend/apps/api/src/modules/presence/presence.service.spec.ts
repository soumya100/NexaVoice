import { Test, TestingModule } from '@nestjs/testing';
import { PresenceStatus, UserAvailability } from '@nexavoice/domain-types';
import { PresenceService } from './presence.service';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SignalingGateway } from '../realtime/signaling.gateway';

describe('PresenceService - Realtime Multi-Device Ephemeral Presence', () => {
  let service: PresenceService;
  let mockRedis: any;
  let mockPrisma: any;
  let mockSignalingGateway: any;

  beforeEach(async () => {
    mockRedis = {
      isRedisConnected: jest.fn().mockReturnValue(false), // test in-memory fallback first
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    mockPrisma = {
      callParticipant: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      contactRelationship: {
        findMany: jest.fn().mockResolvedValue([
          { requesterId: 'user-1', recipientId: 'contact-bob' },
          { requesterId: 'contact-alice', recipientId: 'user-1' },
        ]),
      },
    };

    mockSignalingGateway = {
      broadcastToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceService,
        { provide: RedisService, useValue: mockRedis },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SignalingGateway, useValue: mockSignalingGateway },
      ],
    }).compile();

    service = module.get<PresenceService>(PresenceService);
  });

  it('1. returns OFFLINE and UNAVAILABLE when user has no active devices', async () => {
    const presence = await service.getUserPresence('user-nobody');
    expect(presence.userId).toBe('user-nobody');
    expect(presence.status).toBe(PresenceStatus.OFFLINE);
    expect(presence.isOnline).toBe(false);
    expect(presence.activeDeviceCount).toBe(0);
    expect(presence.availability).toBe(UserAvailability.UNAVAILABLE);
  });

  it('2. registers a device, marks user ONLINE and broadcasts to contacts', async () => {
    const presence = await service.registerDeviceConnection('user-1', 'socket-desktop-1', {
      deviceId: 'dev-desktop',
      deviceType: 'DESKTOP',
    });

    expect(presence.userId).toBe('user-1');
    expect(presence.status).toBe(PresenceStatus.ONLINE);
    expect(presence.isOnline).toBe(true);
    expect(presence.activeDeviceCount).toBe(1);
    expect(presence.availability).toBe(UserAvailability.AVAILABLE);

    // Broadcasts to user themselves and their accepted contacts
    expect(mockSignalingGateway.broadcastToUser).toHaveBeenCalledWith(
      'user-1',
      'presence.updated',
      expect.objectContaining({ isOnline: true }),
    );
    expect(mockSignalingGateway.broadcastToUser).toHaveBeenCalledWith(
      'contact-bob',
      'presence.updated',
      expect.objectContaining({ isOnline: true }),
    );
    expect(mockSignalingGateway.broadcastToUser).toHaveBeenCalledWith(
      'contact-alice',
      'presence.updated',
      expect.objectContaining({ isOnline: true }),
    );
  });

  it('3. multi-device presence: user remains ONLINE when one of multiple devices disconnects', async () => {
    // Connect Desktop and Mobile
    await service.registerDeviceConnection('user-1', 'socket-desktop-1');
    const twoDevices = await service.registerDeviceConnection('user-1', 'socket-mobile-1');
    expect(twoDevices.activeDeviceCount).toBe(2);
    expect(twoDevices.isOnline).toBe(true);

    // Disconnect Desktop only
    const oneLeft = await service.deregisterDeviceConnection('user-1', 'socket-desktop-1');
    expect(oneLeft.activeDeviceCount).toBe(1);
    expect(oneLeft.isOnline).toBe(true);
    expect(oneLeft.status).toBe(PresenceStatus.ONLINE);

    // Disconnect Mobile (last device)
    const noneLeft = await service.deregisterDeviceConnection('user-1', 'socket-mobile-1');
    expect(noneLeft.activeDeviceCount).toBe(0);
    expect(noneLeft.isOnline).toBe(false);
    expect(noneLeft.status).toBe(PresenceStatus.OFFLINE);
  });

  it('4. heartbeats touch timestamp without PostgreSQL write amplification', async () => {
    await service.registerDeviceConnection('user-1', 'socket-1');
    mockPrisma.callParticipant.findFirst.mockClear();
    const acknowledged = await service.recordHeartbeat('user-1', 'socket-1');
    expect(acknowledged).toBe(true);

    // Prisma should never have received an INSERT or UPDATE or query for the heartbeat
    expect(mockPrisma.callParticipant.findFirst).not.toHaveBeenCalled();
  });

  it('5. status update changes presence status and broadcasts to contacts', async () => {
    await service.registerDeviceConnection('user-1', 'socket-1');
    const updated = await service.updateStatus(
      'user-1',
      PresenceStatus.BUSY,
      'In a deep focus session',
    );

    expect(updated.status).toBe(PresenceStatus.BUSY);
    expect(updated.customStatus).toBe('In a deep focus session');
    expect(updated.availability).toBe(UserAvailability.BUSY);

    expect(mockSignalingGateway.broadcastToUser).toHaveBeenCalledWith(
      'contact-bob',
      'presence.updated',
      expect.objectContaining({ status: PresenceStatus.BUSY }),
    );
  });

  it('6. separates presence from availability: active call yields IN_CALL availability', async () => {
    await service.registerDeviceConnection('user-call', 'socket-call-1');

    mockPrisma.callParticipant.findFirst.mockResolvedValueOnce({
      id: 'leg-1',
      userId: 'user-call',
      state: 'CONNECTED',
    });

    const presence = await service.getUserPresence('user-call');
    expect(presence.status).toBe(PresenceStatus.ONLINE);
    expect(presence.availability).toBe(UserAvailability.IN_CALL);
  });

  it('7. sets availability to DO_NOT_DISTURB when user selects DND status', async () => {
    await service.registerDeviceConnection('user-dnd', 'socket-dnd-1');
    await service.updateStatus('user-dnd', PresenceStatus.DO_NOT_DISTURB);

    const presence = await service.getUserPresence('user-dnd');
    expect(presence.status).toBe(PresenceStatus.DO_NOT_DISTURB);
    expect(presence.availability).toBe(UserAvailability.DO_NOT_DISTURB);
  });

  it('8. stores and retrieves presence state from Redis when Redis is connected', async () => {
    mockRedis.isRedisConnected.mockReturnValue(true);
    const mockState = {
      userId: 'user-redis',
      status: PresenceStatus.ONLINE,
      devices: {
        'sock-1': {
          deviceId: 'd1',
          socketId: 'sock-1',
          connectedAt: new Date().toISOString(),
          lastHeartbeatAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    };
    mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockState));

    const presence = await service.getUserPresence('user-redis');
    expect(presence.isOnline).toBe(true);
    expect(presence.activeDeviceCount).toBe(1);
    expect(mockRedis.get).toHaveBeenCalledWith('presence:user:user-redis');
  });
});
