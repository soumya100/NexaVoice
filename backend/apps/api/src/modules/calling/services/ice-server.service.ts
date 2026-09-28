import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { IceServerConfig } from '@nexavoice/domain-types';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

@Injectable()
export class IceServerService {
  private readonly logger = new StructuredLogger('IceServerService');

  constructor(private readonly configService: ConfigService) {}

  /**
   * Generates secure ICE servers configuration for WebRTC signaling.
   * If TURN secret is provided, computes time-limited HMAC-SHA1 credentials (RFC 5766).
   */
  getIceServers(userId: string, ttlSeconds = 86400): IceServerConfig[] {
    const rawStun = this.configService.get<string>('WEBRTC_ICE_SERVERS');
    const turnSecret = this.configService.get<string>('TURN_SECRET');
    const turnUrls = this.configService.get<string>('TURN_URLS');

    const iceServers: IceServerConfig[] = [];

    // 1. STUN servers
    if (rawStun) {
      try {
        const parsed = JSON.parse(rawStun);
        if (Array.isArray(parsed)) {
          iceServers.push(...parsed);
        }
      } catch (e) {
        this.logger.warn({
          event: 'parse_stun_servers_failed',
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (iceServers.length === 0) {
      iceServers.push({
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
        ],
      });
    }

    // 2. Short-lived TURN credentials (ephemeral token)
    if (turnSecret && turnUrls) {
      const expiryTimestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
      const username = `${expiryTimestamp}:${userId}`;
      const hmac = crypto.createHmac('sha1', turnSecret);
      hmac.update(username);
      const credential = hmac.digest('base64');

      const urls = turnUrls.split(',').map((u) => u.trim());

      iceServers.push({
        urls,
        username,
        credential,
      });

      this.logger.debug({
        event: 'ephemeral_turn_credentials_generated',
        userId,
        expiryTimestamp,
      });
    }

    return iceServers;
  }
}
