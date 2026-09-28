import { IceServerConfig, MediaMode, ParticipantRole } from '@nexavoice/domain-types';

export interface CreateMediaSessionOptions {
  mode: MediaMode;
  roomName?: string;
  maxParticipants?: number;
}

export interface MediaSessionResult {
  provider: string;
  mode: MediaMode;
  providerSessionId: string;
  sfuRoomId?: string;
  iceServers: IceServerConfig[];
}

export interface ParticipantMediaResult {
  token?: string;
  joinEndpoint?: string;
}

export interface MediaProvider {
  readonly name: string;
  readonly isSfu: boolean;

  createSession(
    callSessionId: string,
    options?: CreateMediaSessionOptions,
  ): Promise<MediaSessionResult>;

  createParticipant(
    callSessionId: string,
    userId: string,
    role: ParticipantRole,
  ): Promise<ParticipantMediaResult>;

  closeSession(callSessionId: string): Promise<void>;

  getIceServers(userId: string): Promise<IceServerConfig[]>;
}
