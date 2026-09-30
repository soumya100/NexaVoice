import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PresenceStatus, UserAvailability } from '@nexavoice/domain-types';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service';
import { UserPresenceGql } from './presence.types';
import { SignalingGateway } from '../realtime/signaling.gateway';

interface DevicePresenceRecord {
  deviceId: string;
  socketId: string;
  deviceType?: string;
  connectedAt: string;
  lastHeartbeatAt: string;
}

interface UserPresenceState {
  userId: string;
  status: PresenceStatus;
  customStatus?: string;
  devices: Record<string, DevicePresenceRecord>;
  updatedAt: string;
}

const PRESENCE_TTL_SECONDS = 60; // Presence expires after 60s without heartbeat
const REDIS_KEY_PREFIX = 'presence:user:';

@Injectable()
export class PresenceService {
  private readonly logger = new StructuredLogger('PresenceService');

  // Fast in-memory cache/fallback if Redis is offline
  private readonly memoryStore = new Map<string, UserPresenceState>();

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => SignalingGateway))
    private readonly signalingGateway: SignalingGateway,
  ) {}

  /**
   * Builds the Redis key for user presence.
   */
  private getKey(userId: string): string {
    return `${REDIS_KEY_PREFIX}${userId}`;
  }

  /**
   * Retrieves raw presence state from Redis or in-memory fallback.
   */
  private async getRawState(userId: string): Promise<UserPresenceState | null> {
    if (this.redisService.isRedisConnected()) {
      try {
        const data = await this.redisService.get(this.getKey(userId));
        if (data) {
          return JSON.parse(data) as UserPresenceState;
        }
      } catch (err) {
        this.logger.warn({
          event: 'redis_get_presence_failed',
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return this.memoryStore.get(userId) || null;
  }

  /**
   * Persists presence state in Redis with TTL and updates in-memory fallback.
   */
  private async setRawState(userId: string, state: UserPresenceState): Promise<void> {
    this.memoryStore.set(userId, state);

    if (this.redisService.isRedisConnected()) {
      try {
        await this.redisService.set(
          this.getKey(userId),
          JSON.stringify(state),
          PRESENCE_TTL_SECONDS,
        );
      } catch (err) {
        this.logger.warn({
          event: 'redis_set_presence_failed',
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /**
   * Computes user presence and availability derived from active device sessions and call status.
   */
  async getUserPresence(userId: string): Promise<UserPresenceGql> {
    const rawState = await this.getRawState(userId);
    const now = new Date();

    // Clean up stale devices (older than PRESENCE_TTL_SECONDS)
    const activeDevices: DevicePresenceRecord[] = [];
    if (rawState?.devices) {
      for (const dev of Object.values(rawState.devices)) {
        const devAge = (now.getTime() - new Date(dev.lastHeartbeatAt).getTime()) / 1000;
        if (devAge <= PRESENCE_TTL_SECONDS) {
          activeDevices.push(dev);
        }
      }
    }

    const deviceCount = activeDevices.length;
    const isOnline = deviceCount > 0;

    let status = PresenceStatus.OFFLINE;
    if (isOnline) {
      status = rawState?.status && rawState.status !== PresenceStatus.OFFLINE
        ? rawState.status
        : PresenceStatus.ONLINE;
    }

    // Check active call status for availability separation
    let inCall = false;
    try {
      const activeLeg = await this.prisma.callParticipant.findFirst({
        where: {
          userId,
          state: { in: ['CONNECTED', 'JOINED'] },
          callSession: {
            status: { in: ['ACTIVE', 'CONNECTING', 'RINGING'] },
          },
        },
      });
      inCall = !!activeLeg;
    } catch {
      // In-memory or fallback mode
    }

    let availability = UserAvailability.UNAVAILABLE;
    if (!isOnline) {
      availability = UserAvailability.UNAVAILABLE;
    } else if (inCall) {
      availability = UserAvailability.IN_CALL;
    } else if (status === PresenceStatus.DO_NOT_DISTURB) {
      availability = UserAvailability.DO_NOT_DISTURB;
    } else if (status === PresenceStatus.BUSY) {
      availability = UserAvailability.BUSY;
    } else {
      availability = UserAvailability.AVAILABLE;
    }

    return {
      userId,
      status,
      customStatus: rawState?.customStatus,
      activeDeviceCount: deviceCount,
      lastHeartbeatAt: rawState?.updatedAt || now.toISOString(),
      isOnline,
      availability,
    };
  }

  /**
   * Registers a newly connected socket device for a user.
   */
  async registerDeviceConnection(
    userId: string,
    socketId: string,
    deviceInfo?: { deviceId?: string; deviceType?: string },
  ): Promise<UserPresenceGql> {
    const raw = (await this.getRawState(userId)) || {
      userId,
      status: PresenceStatus.ONLINE,
      devices: {},
      updatedAt: new Date().toISOString(),
    };

    const deviceId = deviceInfo?.deviceId || socketId;
    raw.devices[socketId] = {
      deviceId,
      socketId,
      deviceType: deviceInfo?.deviceType || 'WEB',
      connectedAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
    };
    raw.updatedAt = new Date().toISOString();

    await this.setRawState(userId, raw);

    const presence = await this.getUserPresence(userId);
    await this.broadcastPresenceToContacts(userId, presence);
    return presence;
  }

  /**
   * Deregisters a socket device on disconnect without dropping the whole user if other devices exist.
   */
  async deregisterDeviceConnection(userId: string, socketId: string): Promise<UserPresenceGql> {
    const raw = await this.getRawState(userId);
    if (raw && raw.devices[socketId]) {
      delete raw.devices[socketId];
      raw.updatedAt = new Date().toISOString();
      await this.setRawState(userId, raw);
    }

    const presence = await this.getUserPresence(userId);
    await this.broadcastPresenceToContacts(userId, presence);
    return presence;
  }

  /**
   * Refreshes presence TTL via lightweight heartbeat (Zero DB write amplification).
   */
  async recordHeartbeat(userId: string, socketId: string): Promise<boolean> {
    const raw = await this.getRawState(userId);
    if (!raw) return false;

    if (raw.devices[socketId]) {
      raw.devices[socketId].lastHeartbeatAt = new Date().toISOString();
      raw.updatedAt = new Date().toISOString();
      await this.setRawState(userId, raw);
      return true;
    }

    return false;
  }

  /**
   * Updates user status preference (e.g. ONLINE, AWAY, BUSY, DO_NOT_DISTURB).
   */
  async updateStatus(
    userId: string,
    newStatus: PresenceStatus,
    customStatus?: string,
  ): Promise<UserPresenceGql> {
    const raw = (await this.getRawState(userId)) || {
      userId,
      status: newStatus,
      devices: {},
      updatedAt: new Date().toISOString(),
    };

    raw.status = newStatus;
    if (customStatus !== undefined) {
      raw.customStatus = customStatus;
    }
    raw.updatedAt = new Date().toISOString();

    await this.setRawState(userId, raw);

    const presence = await this.getUserPresence(userId);
    await this.broadcastPresenceToContacts(userId, presence);
    return presence;
  }

  /**
   * Broadcasts presence change to user's contacts and mutual conversation channels.
   */
  async broadcastPresenceToContacts(userId: string, presence: UserPresenceGql): Promise<void> {
    try {
      // 1. Send update to user's own connected devices
      this.signalingGateway.broadcastToUser(userId, 'presence.updated', presence);

      // 2. Fetch accepted contacts to inform them of presence change
      const contacts = await this.prisma.contactRelationship.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [{ requesterId: userId }, { recipientId: userId }],
        },
        select: { requesterId: true, recipientId: true },
      });

      const recipientIds = new Set<string>();
      for (const rel of contacts) {
        const contactId = rel.requesterId === userId ? rel.recipientId : rel.requesterId;
        recipientIds.add(contactId);
      }

      for (const targetId of recipientIds) {
        this.signalingGateway.broadcastToUser(targetId, 'presence.updated', presence);
      }
    } catch (err) {
      this.logger.warn({
        event: 'broadcast_presence_error',
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
