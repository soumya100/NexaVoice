import { SignalingGateway } from './signaling.gateway';

describe('SignalingGateway', () => {
  let gateway: SignalingGateway;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockRbacService: any;
  let mockAuthDecisionService: any;
  let mockPrisma: any;

  beforeEach(() => {
    mockJwtService = {
      verifyAsync: jest.fn(),
    };
    mockConfigService = {
      get: jest.fn().mockReturnValue('test-secret'),
    };
    mockRbacService = {
      getUserPermissions: jest.fn(),
    };
    mockAuthDecisionService = {
      authorize: jest.fn(),
    };
    mockPrisma = {
      isDatabaseConnected: jest.fn().mockReturnValue(true),
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve({
            id: where.id,
            accountState: 'ACTIVE',
            tokenVersion: 1,
          }),
        ),
      },
      conversationParticipant: {
        findUnique: jest.fn(),
      },
    };

    gateway = new SignalingGateway(
      mockJwtService,
      mockConfigService,
      mockRbacService,
      mockAuthDecisionService,
      mockPrisma,
    );
  });

  describe('handleJoinConversation', () => {
    it('rejects unauthenticated socket connections', async () => {
      const mockSocket: any = { id: 'sock-1', emit: jest.fn(), disconnect: jest.fn() };
      const res = await gateway.handleJoinConversation(mockSocket, {
        conversationId: 'conv-1',
      });

      expect(res).toEqual({ error: 'Unauthorized socket connection' });
    });

    it('rejects if user is not a participant in the conversation', async () => {
      const mockSocket: any = {
        id: 'sock-auth',
        handshake: { auth: { token: 'valid-token' } },
        emit: jest.fn(),
        join: jest.fn(),
        disconnect: jest.fn(),
      };

      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-intruder',
        tokenVersion: 1,
        roles: ['USER'],
      });

      await gateway.handleConnection(mockSocket);

      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(null);

      const res = await gateway.handleJoinConversation(mockSocket, {
        conversationId: 'conv-private',
      });

      expect(res).toEqual({
        error: 'Forbidden: You are not a participant in this conversation',
      });
      expect(mockSocket.join).not.toHaveBeenCalledWith('conversation:conv-private');
    });

    it('authorizes and joins room if user is a participant', async () => {
      const mockSocket: any = {
        id: 'sock-member',
        handshake: { auth: { token: 'valid-token' } },
        emit: jest.fn(),
        join: jest.fn(),
        disconnect: jest.fn(),
      };

      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-member',
        tokenVersion: 1,
        roles: ['USER'],
      });

      await gateway.handleConnection(mockSocket);

      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({
        id: 'part-1',
        conversationId: 'conv-shared',
        userId: 'user-member',
      });

      const res = await gateway.handleJoinConversation(mockSocket, {
        conversationId: 'conv-shared',
      });

      expect(res).toEqual({ status: 'joined', conversationId: 'conv-shared' });
      expect(mockSocket.join).toHaveBeenCalledWith('conversation:conv-shared');
    });

    it('evictUserFromConversation evicts all active sockets of the user and emits eviction event', async () => {
      const mockSocket: any = {
        id: 'sock-evict',
        handshake: { auth: { token: 'valid-token' } },
        emit: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        disconnect: jest.fn(),
      };

      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-evicted',
        tokenVersion: 1,
        roles: ['USER'],
      });

      gateway.server = {
        sockets: {
          sockets: new Map([['sock-evict', mockSocket]]),
        },
      } as any;

      await gateway.handleConnection(mockSocket);

      gateway.evictUserFromConversation('user-evicted', 'conv-100');

      expect(mockSocket.leave).toHaveBeenCalledWith('conversation:conv-100');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'conversation.evicted',
        expect.objectContaining({
          conversationId: 'conv-100',
          userId: 'user-evicted',
          reason: 'PARTICIPANT_REMOVED',
        }),
      );
    });
  });
});
