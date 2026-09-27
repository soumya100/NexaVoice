import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ContactRelationshipStatus, PrivacyLevel } from '@nexavoice/domain-types';
import { ContactsService } from './contacts.service';

describe('ContactsService', () => {
  let service: ContactsService;
  let mockPrisma: any;
  let mockSecurityAudit: any;

  beforeEach(() => {
    mockSecurityAudit = {
      logEvent: jest.fn().mockResolvedValue({}),
    };

    mockPrisma = {
      userPrivacySettings: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      blockedUser: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
      contactRelationship: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    service = new ContactsService(mockPrisma, mockSecurityAudit);
  });

  describe('sendContactRequest', () => {
    it('throws BadRequestException if user sends request to self', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        nexaVoiceId: 'NV-USER1',
        username: 'alice',
      });

      await expect(
        service.sendContactRequest('user-1', { identifier: 'alice' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if recipient not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.sendContactRequest('user-1', { identifier: 'unknown_user' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if either user blocked the other', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-2',
        nexaVoiceId: 'NV-USER2',
        username: 'bob',
      });
      mockPrisma.blockedUser.findFirst.mockResolvedValue({ id: 'block-1' });

      await expect(
        service.sendContactRequest('user-1', { identifier: 'bob' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deterministically auto-accepts reciprocal pending contact request', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-2',
        nexaVoiceId: 'NV-USER2',
        username: 'bob',
        displayName: 'Bob',
      });
      mockPrisma.blockedUser.findFirst.mockResolvedValue(null);

      // User 2 already sent request to User 1
      mockPrisma.contactRelationship.findUnique.mockResolvedValueOnce({
        id: 'req-inv-1',
        requesterId: 'user-2',
        recipientId: 'user-1',
        status: ContactRelationshipStatus.PENDING,
        createdAt: new Date(),
      });

      mockPrisma.contactRelationship.update.mockResolvedValue({
        id: 'req-inv-1',
        requesterId: 'user-2',
        recipientId: 'user-1',
        status: ContactRelationshipStatus.ACCEPTED,
        createdAt: new Date(),
        acceptedAt: new Date(),
      });

      const result = await service.sendContactRequest('user-1', { identifier: 'bob' });

      expect(result.status).toBe(ContactRelationshipStatus.ACCEPTED);
      expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTACT_REQUEST_AUTO_ACCEPTED_CONCURRENT',
        }),
      );
    });

    it('creates fresh pending request if no previous relationship exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-2',
        nexaVoiceId: 'NV-USER2',
        username: 'bob',
        displayName: 'Bob',
        privacySettings: { whoCanMessageMe: PrivacyLevel.EVERYONE },
      });
      mockPrisma.blockedUser.findFirst.mockResolvedValue(null);
      mockPrisma.contactRelationship.findUnique
        .mockResolvedValueOnce(null) // inverse
        .mockResolvedValueOnce(null); // forward

      mockPrisma.contactRelationship.create.mockResolvedValue({
        id: 'req-new-1',
        requesterId: 'user-1',
        recipientId: 'user-2',
        status: ContactRelationshipStatus.PENDING,
        createdAt: new Date(),
      });

      const result = await service.sendContactRequest('user-1', { identifier: 'bob' });

      expect(result.status).toBe(ContactRelationshipStatus.PENDING);
      expect(mockPrisma.contactRelationship.create).toHaveBeenCalled();
    });
  });

  describe('blocking', () => {
    it('successfully blocks user and cascades to contact relationships', async () => {
      mockPrisma.blockedUser.upsert.mockResolvedValue({});
      mockPrisma.contactRelationship.updateMany.mockResolvedValue({ count: 1 });

      const res = await service.blockUser('user-1', 'user-2', 'Spamming');

      expect(res).toBe(true);
      expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_BLOCKED',
          targetId: 'user-2',
        }),
      );
    });

    it('prevents user from blocking self', async () => {
      await expect(service.blockUser('user-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('discoverUsers', () => {
    it('filters out users who blocked caller or opted out of discovery', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-2',
          nexaVoiceId: 'NV-TARGET',
          username: 'charlie',
          displayName: 'Charlie',
          privacySettings: { discoverableByNexaVoiceId: false, discoverableByUsername: true },
          blockedUsers: [],
          blockedByUsers: [],
          sentContactRequests: [],
          receivedContactRequests: [],
        },
        {
          id: 'user-3',
          nexaVoiceId: 'NV-BLOCKED',
          username: 'david',
          displayName: 'David',
          privacySettings: null,
          blockedUsers: [{ id: 'block-entry' }], // blocked caller!
          blockedByUsers: [],
          sentContactRequests: [],
          receivedContactRequests: [],
        },
      ]);

      const results = await service.discoverUsers('user-1', 'charlie');

      expect(results).toHaveLength(1);
      expect(results[0].username).toBe('charlie');
    });
  });
});
