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
      const mockSocket: any = { id: 'sock-1', emit: jest.fn() };
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
      };

      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-intruder',
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
      };

      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-member',
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
  });
});
