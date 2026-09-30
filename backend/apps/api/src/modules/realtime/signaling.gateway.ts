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
import { Inject, forwardRef } from '@nestjs/common';
import { AccountState, AuthTokenPayload, PermissionAction, PresenceStatus } from '@nexavoice/domain-types';
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service';
import { RbacService } from '../authorization/rbac.service';
import { AuthorizationDecisionService } from '../authorization/authorization-decision.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PresenceService } from '../presence/presence.service';

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
    @Inject(forwardRef(() => PresenceService))
    private readonly presenceService: PresenceService,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.['token'] as string) ||
      (client.handshake.query?.['token'] as string);

    if (!token) {
      this.logger.warn({
        event: 'socket_connection_rejected_no_token',
        socketId: client.id,
      });
      client.emit('auth_error', { message: 'Authentication token required for realtime connection' });
      client.disconnect(true);
      return;
    }

    try {
      if (!this.prisma.isDatabaseConnected()) {
        this.logger.warn({
          event: 'socket_connection_rejected_db_down',
          socketId: client.id,
        });
        client.emit('auth_error', { message: 'Authentication authority unreachable' });
        client.disconnect(true);
        return;
      }

      const secret = this.configService.get<string>('jwt.secret', 'dev-secret-key-32-chars-long-minimum!');
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token, { secret });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          accountState: true,
          tokenVersion: true,
        },
      });

      if (!user) {
        client.emit('auth_error', { message: 'User account does not exist' });
        client.disconnect(true);
        return;
      }

      if (user.tokenVersion !== payload.tokenVersion) {
        client.emit('auth_error', { message: 'Session token invalidated' });
        client.disconnect(true);
        return;
      }

      if (user.accountState === AccountState.SUSPENDED || user.accountState === AccountState.LOCKED) {
        client.emit('auth_error', { message: `Account is ${user.accountState}` });
        client.disconnect(true);
        return;
      }

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

      // Register device connection with PresenceService
      const deviceId = (client.handshake.query?.['deviceId'] as string) || client.id;
      const deviceType = (client.handshake.query?.['deviceType'] as string) || 'WEB';
      await this.presenceService.registerDeviceConnection(payload.sub, client.id, {
        deviceId,
        deviceType,
      });
    } catch (err) {
      this.logger.warn({
        event: 'socket_authentication_failed',
        socketId: client.id,
        error: err instanceof Error ? err.message : String(err),
      });
      client.emit('auth_error', { message: 'Authentication failed: invalid or expired token' });
      client.disconnect(true);
    }
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
      this.presenceService.deregisterDeviceConnection(clientData.userId, client.id).catch((err) => {
        this.logger.warn({
          event: 'presence_deregister_failed',
          socketId: client.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
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

  /**
   * Broadcasts an event to all participants in a call room.
   */
  broadcastToCall(callId: string, event: string, payload: unknown): void {
    if (this.server) {
      this.server.to(`call:${callId}`).emit(event, payload);
    }
  }

  /**
   * Evicts all active sockets of a user from a specific conversation room.
   */
  evictUserFromConversation(userId: string, conversationId: string): void {
    const socketIds = this.userSockets.get(userId);
    const roomName = `conversation:${conversationId}`;

    if (socketIds && socketIds.size > 0) {
      for (const socketId of socketIds) {
        const client = this.server?.sockets?.sockets?.get?.(socketId);
        if (client) {
          client.leave(roomName);
          client.emit('conversation.evicted', {
            conversationId,
            userId,
            reason: 'PARTICIPANT_REMOVED',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    this.logger.log({
      event: 'user_evicted_from_conversation',
      userId,
      conversationId,
      socketsEvicted: socketIds ? socketIds.size : 0,
    });
  }

  /**
   * Evicts all active sockets of a user from a specific call room.
   */
  evictUserFromCall(userId: string, callId: string, reason = 'PARTICIPANT_REMOVED'): void {
    const socketIds = this.userSockets.get(userId);
    const roomName = `call:${callId}`;

    if (socketIds && socketIds.size > 0) {
      for (const socketId of socketIds) {
        const client = this.server?.sockets?.sockets?.get?.(socketId);
        if (client) {
          client.leave(roomName);
          client.emit('call.evicted', {
            callId,
            userId,
            reason,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    this.logger.log({
      event: 'user_evicted_from_call',
      userId,
      callId,
      reason,
      socketsEvicted: socketIds ? socketIds.size : 0,
    });
  }

  /**
   * Evicts all connected sockets from a call room when call is ended.
   */
  evictAllFromCall(callId: string, reason = 'CALL_ENDED'): void {
    const roomName = `call:${callId}`;
    if (this.server) {
      this.server.to(roomName).emit('call.ended', {
        callId,
        reason,
        timestamp: new Date().toISOString(),
      });
      this.server.socketsLeave(roomName);
    }

    this.logger.log({
      event: 'all_users_evicted_from_call',
      callId,
      reason,
    });
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

  @SubscribeMessage('presence:heartbeat')
  async handlePresenceHeartbeat(@ConnectedSocket() client: Socket) {
    const clientData = this.activeClients.get(client.id);
    if (!clientData) return { error: 'Unauthorized socket' };
    const success = await this.presenceService.recordHeartbeat(clientData.userId, client.id);
    return { status: success ? 'heartbeat_acknowledged' : 'heartbeat_ignored' };
  }

  @SubscribeMessage('presence:update')
  async handlePresenceUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { status: PresenceStatus; customStatus?: string },
  ) {
    const clientData = this.activeClients.get(client.id);
    if (!clientData || !payload?.status) return { error: 'Invalid presence payload' };
    const presence = await this.presenceService.updateStatus(
      clientData.userId,
      payload.status,
      payload.customStatus,
    );
    return presence;
  }

  @SubscribeMessage('presence:query')
  async handlePresenceQuery(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { userIds: string[] },
  ) {
    const clientData = this.activeClients.get(client.id);
    if (!clientData || !Array.isArray(payload?.userIds)) return [];
    return Promise.all(payload.userIds.map((uid) => this.presenceService.getUserPresence(uid)));
  }

  @SubscribeMessage('typing-start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const clientData = this.activeClients.get(client.id);
    if (!clientData || !payload?.conversationId) return;

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
    @MessageBody() payload: { callId: string; userId?: string },
  ) {
    const clientData = this.activeClients.get(client.id);
    if (!clientData) {
      return { error: 'Unauthorized socket connection' };
    }

    const userId = clientData.userId;
    if (!payload?.callId) {
      return { error: 'Invalid callId' };
    }

    // Zero-trust verification: check user is authorized for this call
    const call = await this.prisma.callSession.findUnique({
      where: { id: payload.callId },
      include: {
        participants: {
          where: { userId },
        },
      },
    });

    if (!call) {
      return { error: 'Call session not found' };
    }

    if (call.status === 'ENDED' || call.status === 'FAILED' || call.status === 'MISSED' || call.status === 'REJECTED') {
      return { error: `Call session is ${call.status}` };
    }

    const isHost = call.hostUserId === userId;
    const isParticipant = call.participants.length > 0;

    if (!isHost && !isParticipant) {
      this.logger.warn({
        event: 'join_call_denied_not_authorized',
        callId: payload.callId,
        userId,
      });
      return { error: 'Forbidden: You are not authorized to join this call' };
    }

    const perms = await this.rbacService.getUserPermissions(userId);
    const decision = await this.authDecisionService.authorize({
      subject: {
        id: userId,
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
        event: 'join_call_denied_by_policy',
        callId: payload.callId,
        userId,
        reason: decision.reason,
      });
      return { error: `Forbidden: ${decision.reason}` };
    }

    client.join(`call:${payload.callId}`);
    this.logger.log({
      event: 'participant_joined_call',
      callId: payload.callId,
      userId,
      socketId: client.id,
    });

    client.to(`call:${payload.callId}`).emit('call.participant.joined', {
      callId: payload.callId,
      userId,
      socketId: client.id,
      timestamp: new Date().toISOString(),
    });

    return { status: 'joined', callId: payload.callId };
  }

  @SubscribeMessage('signal')
  async handleSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SignalingEventDto,
  ) {
    const clientData = this.activeClients.get(client.id);
    if (!clientData) {
      return { error: 'Unauthorized socket connection' };
    }

    if (!payload?.callId || !payload?.type) {
      return { error: 'Invalid signaling payload' };
    }

    // Verify socket is joined to the call room (prevents signaling injection)
    if (!client.rooms.has(`call:${payload.callId}`)) {
      this.logger.warn({
        event: 'signaling_injection_rejected',
        callId: payload.callId,
        userId: clientData.userId,
      });
      return { error: 'Forbidden: Socket is not a member of this call room' };
    }

    const sanitizedPayload: SignalingEventDto = {
      callId: payload.callId,
      senderId: clientData.userId, // Server-enforced senderId (cannot be forged)
      targetId: payload.targetId,
      type: payload.type,
      data: payload.data,
    };

    if (payload.targetId) {
      // Forward to specific target user
      this.server.to(`user:${payload.targetId}`).emit('call.signal', sanitizedPayload);
    } else {
      // Broadcast to other participants in call room
      client.to(`call:${payload.callId}`).emit('call.signal', sanitizedPayload);
    }

    return { received: true };
  }

  @SubscribeMessage('call:offer')
  async handleCallOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { callId: string; sdp: string; targetUserId?: string },
  ) {
    const clientData = this.activeClients.get(client.id);
    if (!clientData || !client.rooms.has(`call:${payload?.callId}`)) {
      return { error: 'Unauthorized or not in call room' };
    }

    const event = {
      callId: payload.callId,
      senderId: clientData.userId,
      targetUserId: payload.targetUserId,
      sdp: payload.sdp,
      type: 'offer',
      timestamp: new Date().toISOString(),
    };

    if (payload.targetUserId) {
      this.server.to(`user:${payload.targetUserId}`).emit('call.offer', event);
    } else {
      client.to(`call:${payload.callId}`).emit('call.offer', event);
    }

    return { status: 'offer_relayed' };
  }

  @SubscribeMessage('call:answer')
  async handleCallAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { callId: string; sdp: string; targetUserId?: string },
  ) {
    const clientData = this.activeClients.get(client.id);
    if (!clientData || !client.rooms.has(`call:${payload?.callId}`)) {
      return { error: 'Unauthorized or not in call room' };
    }

    const event = {
      callId: payload.callId,
      senderId: clientData.userId,
      targetUserId: payload.targetUserId,
      sdp: payload.sdp,
      type: 'answer',
      timestamp: new Date().toISOString(),
    };

    if (payload.targetUserId) {
      this.server.to(`user:${payload.targetUserId}`).emit('call.answer', event);
    } else {
      client.to(`call:${payload.callId}`).emit('call.answer', event);
    }

    return { status: 'answer_relayed' };
  }

  @SubscribeMessage('call:ice-candidate')
  async handleCallIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { callId: string; candidate: unknown; targetUserId?: string },
  ) {
    const clientData = this.activeClients.get(client.id);
    if (!clientData || !client.rooms.has(`call:${payload?.callId}`)) {
      return { error: 'Unauthorized or not in call room' };
    }

    const event = {
      callId: payload.callId,
      senderId: clientData.userId,
      targetUserId: payload.targetUserId,
      candidate: payload.candidate,
      timestamp: new Date().toISOString(),
    };

    if (payload.targetUserId) {
      this.server.to(`user:${payload.targetUserId}`).emit('call.ice-candidate', event);
    } else {
      client.to(`call:${payload.callId}`).emit('call.ice-candidate', event);
    }

    return { status: 'ice_candidate_relayed' };
  }

  @SubscribeMessage('leave-call')
  handleLeaveCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { callId: string },
  ) {
    const clientData = this.activeClients.get(client.id);
    if (!clientData || !payload?.callId) {
      return { error: 'Invalid leave request' };
    }

    client.leave(`call:${payload.callId}`);
    client.to(`call:${payload.callId}`).emit('call.participant.left', {
      callId: payload.callId,
      userId: clientData.userId,
      timestamp: new Date().toISOString(),
    });

    return { status: 'left', callId: payload.callId };
  }
}
