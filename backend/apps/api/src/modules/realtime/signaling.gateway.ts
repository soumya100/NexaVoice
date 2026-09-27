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
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service';

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
  private activeClients = new Map<string, string>(); // socketId -> userId

  handleConnection(client: Socket) {
    const userId = (client.handshake.query['userId'] as string) || `guest-${client.id.substring(0, 6)}`;
    this.activeClients.set(client.id, userId);

    this.logger.log({
      event: 'client_connected',
      socketId: client.id,
      userId,
      totalActive: this.activeClients.size,
    });

    client.emit('connected', {
      socketId: client.id,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    const userId = this.activeClients.get(client.id);
    this.activeClients.delete(client.id);

    this.logger.log({
      event: 'client_disconnected',
      socketId: client.id,
      userId,
      totalActive: this.activeClients.size,
    });
  }

  getActiveClientCount(): number {
    return this.activeClients.size;
  }

  @SubscribeMessage('join-call')
  handleJoinCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { callId: string; userId: string },
  ) {
    client.join(`call:${payload.callId}`);
    this.logger.log({
      event: 'participant_joined_call',
      callId: payload.callId,
      userId: payload.userId,
      socketId: client.id,
    });

    // Notify other participants in this call room
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
    this.logger.debug({
      event: 'signaling_relay',
      callId: payload.callId,
      type: payload.type,
      senderId: payload.senderId,
      targetId: payload.targetId,
    });

    if (payload.targetId) {
      // Forward to specific target participant
      client.to(`call:${payload.callId}`).emit('signal', payload);
    } else {
      // Broadcast to all participants in the call room except sender
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
