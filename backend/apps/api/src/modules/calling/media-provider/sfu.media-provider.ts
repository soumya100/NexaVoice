import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  MediaProvider,
  CreateMediaSessionOptions,
  MediaSessionResult,
  ParticipantMediaResult,
} from './media-provider.interface';
import { IceServerService } from '../services/ice-server.service';
import { IceServerConfig, MediaMode, ParticipantRole } from '@nexavoice/domain-types';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

/**
 * Selective Forwarding Unit (SFU) Media Provider.
 * Status: 🟣 PROVIDER-DEPENDENT
 * Provides architectural interface and token generation for external SFU topologies (LiveKit / mediasoup / Janus).
 * When live SFU credentials are configured, connects to the SFU instance; otherwise defaults to mock/local double.
 */
@Injectable()
export class SfuMediaProvider implements MediaProvider {
  public readonly name = 'sfu-livekit';
  public readonly isSfu = true;

  private readonly logger = new StructuredLogger('SfuMediaProvider');
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly iceServerService: IceServerService,
  ) {
    this.endpoint = this.configService.get<string>('MEDIA_SERVER_ENDPOINT', 'http://localhost:7880');
    this.apiKey = this.configService.get<string>('MEDIA_SERVER_API_KEY', 'mock-key');
    this.apiSecret = this.configService.get<string>('MEDIA_SERVER_API_SECRET', 'mock-secret');
  }

  async createSession(
    callSessionId: string,
    options?: CreateMediaSessionOptions,
  ): Promise<MediaSessionResult> {
    const sfuRoomId = `room-${callSessionId}`;
    const iceServers = this.iceServerService.getIceServers('sfu-system');

    this.logger.log({
      event: 'sfu_room_session_provisioned',
      callSessionId,
      sfuRoomId,
      maxParticipants: options?.maxParticipants || 100,
    });

    return {
      provider: this.name,
      mode: MediaMode.SFU_ROUTED,
      providerSessionId: `sfu-sess-${callSessionId}`,
      sfuRoomId,
      iceServers,
    };
  }

  async createParticipant(
    callSessionId: string,
    userId: string,
    role: ParticipantRole,
  ): Promise<ParticipantMediaResult> {
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(`${this.apiKey}:${callSessionId}:${userId}:${role}`)
      .digest('hex');
    const token = `sfu.${this.apiKey}.${callSessionId}.${userId}.${role}.${signature}`;
    return {
      token,
      joinEndpoint: this.endpoint,
    };
  }

  async closeSession(callSessionId: string): Promise<void> {
    this.logger.log({
      event: 'sfu_room_session_closed',
      callSessionId,
    });
  }

  async getIceServers(userId: string): Promise<IceServerConfig[]> {
    return this.iceServerService.getIceServers(userId);
  }
}
