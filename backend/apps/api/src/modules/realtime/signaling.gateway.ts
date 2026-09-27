import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AccountState, AuthTokenPayload, PermissionAction } from '@nexavoice/domain-types';
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service';
import { RbacService } from '../authorization/rbac.service';
import { AuthorizationDecisionService } from '../authorization/authorization-decision.service';

interface SignalingEventDto {
  callId: string;
  senderId: string;
  targetId?: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'mute' | 'hold' | 'leave';
  data: unknown;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/realtime',
})
export class SignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new StructuredLogger('SignalingGateway');
  private activeClients = new Map<string, { userId: string; roles: string[] }>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly rbacService: RbacService,
    private readonly authDecisionService: AuthorizationDecisionService,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.['token'] as string) ||
      (client.handshake.query?.['token'] as string);

    // Verify JWT token during handshake
    if (token) {
      try {
        const secret = this.configService.get<string>('jwt.secret', 'dev-secret-key-32-chars-long-minimum!');
        const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token, { secret });

        this.activeClients.set(client.id, {
          userId: payload.sub,
          roles: payload.roles || [],
        });

        this.logger.log({
          event: 'client_authenticated',
          socketId: client.id,
          userId: payload.sub,
          totalActive: this.activeClients.size,
        });

        client.emit('authenticated', {
          socketId: client.id,
          userId: payload.sub,
          nexaVoiceId: payload.nexaVoiceId,
          timestamp: new Date().toISOString(),
        });
        return;
      } catch (err) {
        this.logger.warn({
          event: 'socket_authentication_failed',
          socketId: client.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Allow unauthenticated guest connections in development fallback if needed, but restrict operations
    const guestId = `guest-${client.id.substring(0, 6)}`;
    this.activeClients.set(client.id, { userId: guestId, roles: ['GUEST'] });

    client.emit('connected', {
      socketId: client.id,
      userId: guestId,
      isGuest: true,
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    const clientData = this.activeClients.get(client.id);
    this.activeClients.delete(client.id);

    this.logger.log({
      event: 'client_disconnected',
      socketId: client.id,
      userId: clientData?.userId,
      totalActive: this.activeClients.size,
    });
  }

  getActiveClientCount(): number {
    return this.activeClients.size;
  }

  @SubscribeMessage('join-call')
  async handleJoinCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { callId: string; userId: string },
  ) {
    const clientData = this.activeClients.get(client.id);
    if (!clientData) {
      return { error: 'Unauthorized socket connection' };
    }

    const perms = await this.rbacService.getUserPermissions(clientData.userId);
    const decision = await this.authDecisionService.authorize({
      subject: {
        id: clientData.userId,
        nexaVoiceId: '',
        accountState: AccountState.ACTIVE,
        roles: clientData.roles,
        permissions: perms.permissions,
      },
      action: PermissionAction.CALL_JOIN,
      resource: {
        type: 'CallSession',
        id: payload.callId,
      },
    });

    if (!decision.allowed) {
      this.logger.warn({
        event: 'join_call_denied',
        callId: payload.callId,
        userId: clientData.userId,
        reason: decision.reason,
      });
      return { error: `Forbidden: ${decision.reason}` };
    }

    client.join(`call:${payload.callId}`);
    this.logger.log({
      event: 'participant_joined_call',
      callId: payload.callId,
      userId: payload.userId,
      socketId: client.id,
    });

    client.to(`call:${payload.callId}`).emit('participant-joined', {
      callId: payload.callId,
      userId: payload.userId,
      socketId: client.id,
      timestamp: new Date().toISOString(),
    });

    return { status: 'joined', callId: payload.callId };
  }

  @SubscribeMessage('signal')
  handleSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SignalingEventDto,
  ) {
    const clientData = this.activeClients.get(client.id);
    if (!clientData) {
      return { error: 'Unauthorized socket connection' };
    }

    this.logger.debug({
      event: 'signaling_relay',
      callId: payload.callId,
      type: payload.type,
      senderId: payload.senderId,
      targetId: payload.targetId,
    });

    if (payload.targetId) {
      client.to(`call:${payload.callId}`).emit('signal', payload);
    } else {
      client.to(`call:${payload.callId}`).emit('signal', payload);
    }

    return { received: true };
  }

  @SubscribeMessage('leave-call')
  handleLeaveCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { callId: string; userId: string },
  ) {
    client.leave(`call:${payload.callId}`);
    client.to(`call:${payload.callId}`).emit('participant-left', {
      callId: payload.callId,
      userId: payload.userId,
      timestamp: new Date().toISOString(),
    });

    return { status: 'left', callId: payload.callId };
  }
}
