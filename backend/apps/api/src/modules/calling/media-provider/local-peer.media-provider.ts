import { Injectable } from '@nestjs/common';
import {
  MediaProvider,
  CreateMediaSessionOptions,
  MediaSessionResult,
  ParticipantMediaResult,
} from './media-provider.interface';
import { IceServerService } from '../services/ice-server.service';
import { IceServerConfig, MediaMode, ParticipantRole } from '@nexavoice/domain-types';

/**
 * Local Peer Media Provider.
 * Status: 🟢 IMPLEMENTED + VALIDATED
 * Direct WebRTC signaling provider using NestJS Socket.IO control plane and client ICE negotiation.
 */
@Injectable()
export class LocalPeerMediaProvider implements MediaProvider {
  public readonly name = 'local-peer-webrtc';
  public readonly isSfu = false;

  constructor(private readonly iceServerService: IceServerService) {}

  async createSession(
    callSessionId: string,
    options?: CreateMediaSessionOptions,
  ): Promise<MediaSessionResult> {
    const iceServers = this.iceServerService.getIceServers('system');
    return {
      provider: this.name,
      mode: options?.mode || MediaMode.P2P_DIRECT,
      providerSessionId: `p2p-${callSessionId}`,
      iceServers,
    };
  }

  async createParticipant(
    _callSessionId: string,
    _userId: string,
    _role: ParticipantRole,
  ): Promise<ParticipantMediaResult> {
    return {};
  }

  async closeSession(_callSessionId: string): Promise<void> {
    // P2P sessions are torn down on client socket disconnect
  }

  async getIceServers(userId: string): Promise<IceServerConfig[]> {
    return this.iceServerService.getIceServers(userId);
  }
}
