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
import { PrismaService } from '../../infrastructure/database/prisma.service';

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
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly rbacService: RbacService,
    private readonly authDecisionService: AuthorizationDecisionService,
    private readonly prisma: PrismaService,
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

        if (!this.userSockets.has(payload.sub)) {
          this.userSockets.set(payload.sub, new Set());
        }
        this.userSockets.get(payload.sub)!.add(client.id);

        // Join individual user room for direct user notifications
        client.join(`user:${payload.sub}`);

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
    if (clientData) {
      const userSocketsSet = this.userSockets.get(clientData.userId);
      if (userSocketsSet) {
        userSocketsSet.delete(client.id);
        if (userSocketsSet.size === 0) {
          this.userSockets.delete(clientData.userId);
        }
      }
    }
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

  /**
   * Broadcasts an authorized message event to a conversation room.
   */
  broadcastToConversation(conversationId: string, event: string, payload: unknown): void {
    if (this.server) {
      this.server.to(`conversation:${conversationId}`).emit(event, payload);
    }
  }

  /**
   * Broadcasts an event to all connected sockets of a specific user.
   */
  broadcastToUser(userId: string, event: string, payload: unknown): void {
    if (this.server) {
      this.server.to(`user:${userId}`).emit(event, payload);
    }
  }

  @SubscribeMessage('join-conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const clientData = this.activeClients.get(client.id);
    if (!clientData || clientData.userId.startsWith('guest-')) {
      return { error: 'Unauthorized socket connection' };
    }

    if (!payload?.conversationId) {
      return { error: 'Invalid conversationId' };
    }

    // Authorize socket access: verify membership in conversation
    const membership = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: payload.conversationId,
          userId: clientData.userId,
        },
      },
    });

    if (!membership) {
      this.logger.warn({
        event: 'join_conversation_denied',
        conversationId: payload.conversationId,
        userId: clientData.userId,
        reason: 'NOT_A_PARTICIPANT',
      });
      return { error: 'Forbidden: You are not a participant in this conversation' };
    }

    client.join(`conversation:${payload.conversationId}`);
    this.logger.log({
      event: 'joined_conversation_room',
      conversationId: payload.conversationId,
      userId: clientData.userId,
      socketId: client.id,
    });

    return { status: 'joined', conversationId: payload.conversationId };
  }

  @SubscribeMessage('leave-conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    client.leave(`conversation:${payload.conversationId}`);
    return { status: 'left', conversationId: payload.conversationId };
  }

  @SubscribeMessage('typing-start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const clientData = this.activeClients.get(client.id);
    if (!clientData || !payload?.conversationId) return;

    // Verify room membership
    if (client.rooms.has(`conversation:${payload.conversationId}`)) {
      client.to(`conversation:${payload.conversationId}`).emit('conversation.typing.started', {
        conversationId: payload.conversationId,
        userId: clientData.userId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('typing-stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const clientData = this.activeClients.get(client.id);
    if (!clientData || !payload?.conversationId) return;

    if (client.rooms.has(`conversation:${payload.conversationId}`)) {
      client.to(`conversation:${payload.conversationId}`).emit('conversation.typing.stopped', {
        conversationId: payload.conversationId,
        userId: clientData.userId,
        timestamp: new Date().toISOString(),
      });
    }
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
