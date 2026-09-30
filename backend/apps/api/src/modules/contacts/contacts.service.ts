import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  ContactRelationshipStatus,
  PrivacyLevel,
} from '@nexavoice/domain-types';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SecurityAuditService } from '../security/security-audit.service';
import {
  AddressBookMatchResultGql,
  AddContactToGroupInput,
  BlockedUserEntryGql,
  ContactDiscoveryResultGql,
  ContactGroupGql,
  ContactRelationshipGql,
  ContactRequestGql,
  CreateContactGroupInput,
  OrganizationDirectoryInput,
  OrganizationMemberGql,
  SendContactRequestInput,
  SyncAddressBookInput,
  UpdatePrivacySettingsInput,
  UserPrivacySettingsGql,
} from './contacts.types';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  /**
   * Retrieves or initializes privacy settings for a user.
   */
  async getPrivacySettings(userId: string): Promise<UserPrivacySettingsGql> {
    let settings = await this.prisma.userPrivacySettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.userPrivacySettings.create({
        data: {
          userId,
          discoverableByNexaVoiceId: true,
          discoverableByUsername: true,
          discoverableByEmail: false,
          discoverableByPhone: false,
          whoCanMessageMe: PrivacyLevel.EVERYONE,
          whoCanAddMeToGroups: PrivacyLevel.EVERYONE,
          readReceiptsEnabled: true,
          typingIndicatorsEnabled: true,
        },
      });
    }

    return {
      id: settings.id,
      userId: settings.userId,
      discoverableByNexaVoiceId: settings.discoverableByNexaVoiceId,
      discoverableByUsername: settings.discoverableByUsername,
      discoverableByEmail: settings.discoverableByEmail,
      discoverableByPhone: settings.discoverableByPhone,
      whoCanMessageMe: settings.whoCanMessageMe as PrivacyLevel,
      whoCanAddMeToGroups: settings.whoCanAddMeToGroups as PrivacyLevel,
      readReceiptsEnabled: settings.readReceiptsEnabled,
      typingIndicatorsEnabled: settings.typingIndicatorsEnabled,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  /**
   * Updates privacy settings.
   */
  async updatePrivacySettings(
    userId: string,
    input: UpdatePrivacySettingsInput,
  ): Promise<UserPrivacySettingsGql> {
    const updated = await this.prisma.userPrivacySettings.upsert({
      where: { userId },
      create: {
        userId,
        discoverableByNexaVoiceId: input.discoverableByNexaVoiceId ?? true,
        discoverableByUsername: input.discoverableByUsername ?? true,
        discoverableByEmail: input.discoverableByEmail ?? false,
        discoverableByPhone: input.discoverableByPhone ?? false,
        whoCanMessageMe: input.whoCanMessageMe ?? PrivacyLevel.EVERYONE,
        whoCanAddMeToGroups: input.whoCanAddMeToGroups ?? PrivacyLevel.EVERYONE,
        readReceiptsEnabled: input.readReceiptsEnabled ?? true,
        typingIndicatorsEnabled: input.typingIndicatorsEnabled ?? true,
      },
      update: {
        ...(input.discoverableByNexaVoiceId !== undefined && {
          discoverableByNexaVoiceId: input.discoverableByNexaVoiceId,
        }),
        ...(input.discoverableByUsername !== undefined && {
          discoverableByUsername: input.discoverableByUsername,
        }),
        ...(input.discoverableByEmail !== undefined && {
          discoverableByEmail: input.discoverableByEmail,
        }),
        ...(input.discoverableByPhone !== undefined && {
          discoverableByPhone: input.discoverableByPhone,
        }),
        ...(input.whoCanMessageMe !== undefined && {
          whoCanMessageMe: input.whoCanMessageMe,
        }),
        ...(input.whoCanAddMeToGroups !== undefined && {
          whoCanAddMeToGroups: input.whoCanAddMeToGroups,
        }),
        ...(input.readReceiptsEnabled !== undefined && {
          readReceiptsEnabled: input.readReceiptsEnabled,
        }),
        ...(input.typingIndicatorsEnabled !== undefined && {
          typingIndicatorsEnabled: input.typingIndicatorsEnabled,
        }),
      },
    });

    await this.securityAudit.logEvent({
      actorId: userId,
      action: 'PRIVACY_SETTINGS_UPDATED',
      result: 'SUCCESS',
      metadata: { settingsId: updated.id },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      discoverableByNexaVoiceId: updated.discoverableByNexaVoiceId,
      discoverableByUsername: updated.discoverableByUsername,
      discoverableByEmail: updated.discoverableByEmail,
      discoverableByPhone: updated.discoverableByPhone,
      whoCanMessageMe: updated.whoCanMessageMe as PrivacyLevel,
      whoCanAddMeToGroups: updated.whoCanAddMeToGroups as PrivacyLevel,
      readReceiptsEnabled: updated.readReceiptsEnabled,
      typingIndicatorsEnabled: updated.typingIndicatorsEnabled,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Checks if userA has blocked userB or userB has blocked userA.
   */
  async isBlocked(userAId: string, userBId: string): Promise<boolean> {
    const block = await this.prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: userAId, blockedId: userBId },
          { blockerId: userBId, blockedId: userAId },
        ],
      },
    });
    return !!block;
  }

  /**
   * Lists accepted contacts for a user.
   */
  /**
   * Lists accepted contacts for a user with targeted projection.
   */
  async getContacts(userId: string): Promise<ContactRelationshipGql[]> {
    const contactUserSelect = {
      id: true,
      nexaVoiceId: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    };

    const relationships = await this.prisma.contactRelationship.findMany({
      where: {
        status: ContactRelationshipStatus.ACCEPTED,
        OR: [{ requesterId: userId }, { recipientId: userId }],
      },
      include: {
        requester: { select: contactUserSelect },
        recipient: { select: contactUserSelect },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return relationships.map((rel) => {
      const isRequester = rel.requesterId === userId;
      const contactUser = isRequester ? rel.recipient : rel.requester;
      return {
        id: rel.id,
        requesterId: rel.requesterId,
        recipientId: rel.recipientId,
        status: rel.status as ContactRelationshipStatus,
        nickname: rel.nickname || undefined,
        createdAt: rel.createdAt.toISOString(),
        acceptedAt: rel.acceptedAt?.toISOString(),
        contact: {
          id: contactUser.id,
          nexaVoiceId: contactUser.nexaVoiceId,
          username: contactUser.username,
          displayName: contactUser.displayName,
          avatarUrl: contactUser.avatarUrl || undefined,
        },
      };
    });
  }

  /**
   * Lists pending contact requests with targeted projection.
   */
  async getContactRequests(
    userId: string,
    filter: 'incoming' | 'outgoing' | 'all' = 'all',
  ): Promise<ContactRequestGql[]> {
    const contactUserSelect = {
      id: true,
      nexaVoiceId: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    };

    const whereClause: Record<string, unknown> = {
      status: ContactRelationshipStatus.PENDING,
    };

    if (filter === 'incoming') {
      whereClause['recipientId'] = userId;
    } else if (filter === 'outgoing') {
      whereClause['requesterId'] = userId;
    } else {
      whereClause['OR'] = [{ requesterId: userId }, { recipientId: userId }];
    }

    const requests = await this.prisma.contactRelationship.findMany({
      where: whereClause,
      include: {
        requester: { select: contactUserSelect },
        recipient: { select: contactUserSelect },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((req) => ({
      id: req.id,
      requesterId: req.requesterId,
      recipientId: req.recipientId,
      status: req.status as ContactRelationshipStatus,
      createdAt: req.createdAt.toISOString(),
      requester: {
        id: req.requester.id,
        nexaVoiceId: req.requester.nexaVoiceId,
        username: req.requester.username,
        displayName: req.requester.displayName,
        avatarUrl: req.requester.avatarUrl || undefined,
      },
      recipient: {
        id: req.recipient.id,
        nexaVoiceId: req.recipient.nexaVoiceId,
        username: req.recipient.username,
        displayName: req.recipient.displayName,
        avatarUrl: req.recipient.avatarUrl || undefined,
      },
    }));
  }

  /**
   * Sends a contact request with deterministic concurrent resolution.
   */
  async sendContactRequest(
    requesterId: string,
    input: SendContactRequestInput,
  ): Promise<ContactRelationshipGql> {
    const rawIdentifier = input.identifier.trim();

    // 1. Locate recipient
    const recipient = await this.prisma.user.findFirst({
      where: {
        OR: [
          { nexaVoiceId: rawIdentifier },
          { username: { equals: rawIdentifier, mode: 'insensitive' } },
        ],
      },
      include: { privacySettings: true },
    });

    if (!recipient) {
      throw new NotFoundException('User not found with the provided identifier');
    }

    if (recipient.id === requesterId) {
      throw new BadRequestException('You cannot add yourself as a contact');
    }

    // 2. Check blocking in both directions
    const blocked = await this.isBlocked(requesterId, recipient.id);
    if (blocked) {
      throw new ForbiddenException('Unable to send contact request to this user');
    }

    // 3. Verify recipient privacy permissions
    const privacy = recipient.privacySettings;
    if (privacy) {
      if (privacy.whoCanMessageMe === PrivacyLevel.NOBODY) {
        throw new ForbiddenException('User is not accepting contact requests');
      }
    }

    // 4. Deterministic resolution of reciprocal / concurrent requests
    // Check if recipient has ALREADY sent a pending request to us:
    const inverseRelationship = await this.prisma.contactRelationship.findUnique({
      where: {
        requesterId_recipientId: {
          requesterId: recipient.id,
          recipientId: requesterId,
        },
      },
      include: { requester: true, recipient: true },
    });

    if (inverseRelationship) {
      if (inverseRelationship.status === ContactRelationshipStatus.PENDING) {
        // Mutual intent! Deterministically auto-accept!
        const accepted = await this.prisma.contactRelationship.update({
          where: { id: inverseRelationship.id },
          data: {
            status: ContactRelationshipStatus.ACCEPTED,
            acceptedAt: new Date(),
          },
          include: { requester: true, recipient: true },
        });

        await this.securityAudit.logEvent({
          actorId: requesterId,
          action: 'CONTACT_REQUEST_AUTO_ACCEPTED_CONCURRENT',
          targetType: 'User',
          targetId: recipient.id,
          result: 'SUCCESS',
        });

        return {
          id: accepted.id,
          requesterId: accepted.requesterId,
          recipientId: accepted.recipientId,
          status: accepted.status as ContactRelationshipStatus,
          nickname: accepted.nickname || undefined,
          createdAt: accepted.createdAt.toISOString(),
          acceptedAt: accepted.acceptedAt?.toISOString(),
          contact: {
            id: recipient.id,
            nexaVoiceId: recipient.nexaVoiceId,
            username: recipient.username,
            displayName: recipient.displayName,
            avatarUrl: recipient.avatarUrl || undefined,
          },
        };
      } else if (inverseRelationship.status === ContactRelationshipStatus.ACCEPTED) {
        return {
          id: inverseRelationship.id,
          requesterId: inverseRelationship.requesterId,
          recipientId: inverseRelationship.recipientId,
          status: inverseRelationship.status as ContactRelationshipStatus,
          createdAt: inverseRelationship.createdAt.toISOString(),
          acceptedAt: inverseRelationship.acceptedAt?.toISOString(),
          contact: {
            id: recipient.id,
            nexaVoiceId: recipient.nexaVoiceId,
            username: recipient.username,
            displayName: recipient.displayName,
            avatarUrl: recipient.avatarUrl || undefined,
          },
        };
      }
    }

    // Check existing forward relationship
    const existing = await this.prisma.contactRelationship.findUnique({
      where: {
        requesterId_recipientId: {
          requesterId,
          recipientId: recipient.id,
        },
      },
      include: { requester: true, recipient: true },
    });

    if (existing) {
      if (existing.status === ContactRelationshipStatus.ACCEPTED) {
        return {
          id: existing.id,
          requesterId: existing.requesterId,
          recipientId: existing.recipientId,
          status: existing.status as ContactRelationshipStatus,
          createdAt: existing.createdAt.toISOString(),
          acceptedAt: existing.acceptedAt?.toISOString(),
          contact: {
            id: recipient.id,
            nexaVoiceId: recipient.nexaVoiceId,
            username: recipient.username,
            displayName: recipient.displayName,
            avatarUrl: recipient.avatarUrl || undefined,
          },
        };
      }
      if (existing.status === ContactRelationshipStatus.PENDING) {
        throw new ConflictException('A contact request is already pending for this user');
      }

      // If previously REJECTED or REMOVED, re-open as PENDING
      const updated = await this.prisma.contactRelationship.update({
        where: { id: existing.id },
        data: {
          status: ContactRelationshipStatus.PENDING,
          nickname: input.nickname,
          acceptedAt: null,
          blockedAt: null,
        },
        include: { requester: true, recipient: true },
      });

      return {
        id: updated.id,
        requesterId: updated.requesterId,
        recipientId: updated.recipientId,
        status: updated.status as ContactRelationshipStatus,
        createdAt: updated.createdAt.toISOString(),
        contact: {
          id: recipient.id,
          nexaVoiceId: recipient.nexaVoiceId,
          username: recipient.username,
          displayName: recipient.displayName,
          avatarUrl: recipient.avatarUrl || undefined,
        },
      };
    }

    // Create fresh PENDING relationship
    const created = await this.prisma.contactRelationship.create({
      data: {
        requesterId,
        recipientId: recipient.id,
        status: ContactRelationshipStatus.PENDING,
        nickname: input.nickname,
      },
      include: { requester: true, recipient: true },
    });

    await this.securityAudit.logEvent({
      actorId: requesterId,
      action: 'CONTACT_REQUEST_SENT',
      targetType: 'User',
      targetId: recipient.id,
      result: 'SUCCESS',
    });

    await this.prisma.outboxEvent.create({
      data: {
        eventType: 'contact.requested',
        aggregateType: 'User',
        aggregateId: recipient.id,
        payloadJson: JSON.stringify({
          requestId: created.id,
          requesterId,
          recipientId: recipient.id,
        }),
        status: 'PENDING',
        correlationId: created.id,
      },
    });

    return {
      id: created.id,
      requesterId: created.requesterId,
      recipientId: created.recipientId,
      status: created.status as ContactRelationshipStatus,
      nickname: created.nickname || undefined,
      createdAt: created.createdAt.toISOString(),
      contact: {
        id: recipient.id,
        nexaVoiceId: recipient.nexaVoiceId,
        username: recipient.username,
        displayName: recipient.displayName,
        avatarUrl: recipient.avatarUrl || undefined,
      },
    };
  }

  /**
   * Accepts a pending contact request.
   */
  async acceptContactRequest(userId: string, requestId: string): Promise<ContactRelationshipGql> {
    const request = await this.prisma.contactRelationship.findUnique({
      where: { id: requestId },
      include: { requester: true, recipient: true },
    });

    if (!request) {
      throw new NotFoundException('Contact request not found');
    }

    if (request.recipientId !== userId) {
      throw new ForbiddenException('Only the recipient can accept a contact request');
    }

    if (request.status === ContactRelationshipStatus.ACCEPTED) {
      const contactUser = request.requester;
      return {
        id: request.id,
        requesterId: request.requesterId,
        recipientId: request.recipientId,
        status: request.status as ContactRelationshipStatus,
        createdAt: request.createdAt.toISOString(),
        acceptedAt: request.acceptedAt?.toISOString(),
        contact: {
          id: contactUser.id,
          nexaVoiceId: contactUser.nexaVoiceId,
          username: contactUser.username,
          displayName: contactUser.displayName,
          avatarUrl: contactUser.avatarUrl || undefined,
        },
      };
    }

    const updated = await this.prisma.contactRelationship.update({
      where: { id: requestId },
      data: {
        status: ContactRelationshipStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
      include: { requester: true, recipient: true },
    });

    await this.securityAudit.logEvent({
      actorId: userId,
      action: 'CONTACT_REQUEST_ACCEPTED',
      targetType: 'User',
      targetId: request.requesterId,
      result: 'SUCCESS',
    });

    await this.prisma.outboxEvent.create({
      data: {
        eventType: 'contact.accepted',
        aggregateType: 'User',
        aggregateId: request.requesterId,
        payloadJson: JSON.stringify({
          requestId: updated.id,
          contactUserId: userId,
        }),
        status: 'PENDING',
        correlationId: updated.id,
      },
    });

    const contactUser = updated.requester;
    return {
      id: updated.id,
      requesterId: updated.requesterId,
      recipientId: updated.recipientId,
      status: updated.status as ContactRelationshipStatus,
      createdAt: updated.createdAt.toISOString(),
      acceptedAt: updated.acceptedAt?.toISOString(),
      contact: {
        id: contactUser.id,
        nexaVoiceId: contactUser.nexaVoiceId,
        username: contactUser.username,
        displayName: contactUser.displayName,
        avatarUrl: contactUser.avatarUrl || undefined,
      },
    };
  }

  /**
   * Rejects a contact request.
   */
  async rejectContactRequest(userId: string, requestId: string): Promise<boolean> {
    const request = await this.prisma.contactRelationship.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Contact request not found');
    }

    if (request.recipientId !== userId) {
      throw new ForbiddenException('Only the recipient can reject a contact request');
    }

    await this.prisma.contactRelationship.update({
      where: { id: requestId },
      data: { status: ContactRelationshipStatus.REJECTED },
    });

    await this.securityAudit.logEvent({
      actorId: userId,
      action: 'CONTACT_REQUEST_REJECTED',
      targetType: 'User',
      targetId: request.requesterId,
      result: 'SUCCESS',
    });

    return true;
  }

  /**
   * Removes an existing contact.
   */
  async removeContact(userId: string, contactUserId: string): Promise<boolean> {
    const relationship = await this.prisma.contactRelationship.findFirst({
      where: {
        OR: [
          { requesterId: userId, recipientId: contactUserId },
          { requesterId: contactUserId, recipientId: userId },
        ],
      },
    });

    if (!relationship) {
      throw new NotFoundException('Contact relationship not found');
    }

    await this.prisma.contactRelationship.update({
      where: { id: relationship.id },
      data: { status: ContactRelationshipStatus.REMOVED },
    });

    await this.securityAudit.logEvent({
      actorId: userId,
      action: 'CONTACT_REMOVED',
      targetType: 'User',
      targetId: contactUserId,
      result: 'SUCCESS',
    });

    await this.prisma.outboxEvent.create({
      data: {
        eventType: 'contact.removed',
        aggregateType: 'User',
        aggregateId: contactUserId,
        payloadJson: JSON.stringify({
          userId,
          contactUserId,
        }),
        status: 'PENDING',
        correlationId: relationship.id,
      },
    });

    return true;
  }

  /**
   * Blocks a user, removing any active contact relationship and preventing interactions.
   */
  async blockUser(blockerId: string, blockedUserId: string, reason?: string): Promise<boolean> {
    if (blockerId === blockedUserId) {
      throw new BadRequestException('You cannot block yourself');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.blockedUser.upsert({
        where: {
          blockerId_blockedId: { blockerId, blockedId: blockedUserId },
        },
        create: { blockerId, blockedId: blockedUserId, reason },
        update: { reason },
      });

      // Update existing relationship to BLOCKED if present
      await tx.contactRelationship.updateMany({
        where: {
          OR: [
            { requesterId: blockerId, recipientId: blockedUserId },
            { requesterId: blockedUserId, recipientId: blockerId },
          ],
        },
        data: {
          status: ContactRelationshipStatus.BLOCKED,
          blockedAt: new Date(),
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'contact.blocked',
          aggregateType: 'User',
          aggregateId: blockedUserId,
          payloadJson: JSON.stringify({
            blockerId,
            blockedUserId,
          }),
          status: 'PENDING',
        },
      });
    });

    await this.securityAudit.logEvent({
      actorId: blockerId,
      action: 'USER_BLOCKED',
      targetType: 'User',
      targetId: blockedUserId,
      result: 'SUCCESS',
      metadata: { reason },
    });

    return true;
  }

  /**
   * Unblocks a user.
   */
  async unblockUser(blockerId: string, blockedUserId: string): Promise<boolean> {
    await this.prisma.$transaction(async (tx) => {
      await tx.blockedUser.deleteMany({
        where: { blockerId, blockedId: blockedUserId },
      });

      await tx.contactRelationship.updateMany({
        where: {
          requesterId: blockerId,
          recipientId: blockedUserId,
          status: ContactRelationshipStatus.BLOCKED,
        },
        data: {
          status: ContactRelationshipStatus.REMOVED,
        },
      });
    });

    await this.securityAudit.logEvent({
      actorId: blockerId,
      action: 'USER_UNBLOCKED',
      targetType: 'User',
      targetId: blockedUserId,
      result: 'SUCCESS',
    });

    return true;
  }

  /**
   * Lists users blocked by the caller.
   */
  async getBlockedUsers(userId: string): Promise<BlockedUserEntryGql[]> {
    const blocks = await this.prisma.blockedUser.findMany({
      where: { blockerId: userId },
      include: { blocked: true },
      orderBy: { createdAt: 'desc' },
    });

    return blocks.map((b) => ({
      id: b.id,
      blockedId: b.blockedId,
      reason: b.reason || undefined,
      createdAt: b.createdAt.toISOString(),
      user: {
        id: b.blocked.id,
        nexaVoiceId: b.blocked.nexaVoiceId,
        username: b.blocked.username,
        displayName: b.blocked.displayName,
        avatarUrl: b.blocked.avatarUrl || undefined,
      },
    }));
  }

  /**
   * Privacy-preserving contact discovery.
   * Prevents user enumeration by respecting user privacy flags.
   */
  async discoverUsers(callerId: string, query: string): Promise<ContactDiscoveryResultGql[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length < 2) {
      return [];
    }

    // Find candidate users
    const candidates = await this.prisma.user.findMany({
      where: {
        id: { not: callerId },
        OR: [
          { nexaVoiceId: { contains: cleanQuery, mode: 'insensitive' } },
          { username: { contains: cleanQuery, mode: 'insensitive' } },
          { displayName: { contains: cleanQuery, mode: 'insensitive' } },
        ],
      },
      include: {
        privacySettings: true,
        blockedUsers: { where: { blockedId: callerId } },
        blockedByUsers: { where: { blockerId: callerId } },
        sentContactRequests: { where: { recipientId: callerId } },
        receivedContactRequests: { where: { requesterId: callerId } },
      },
      take: 20,
    });

    const results: ContactDiscoveryResultGql[] = [];

    for (const user of candidates) {
      // If user blocked caller, omit completely to avoid enumeration/harassment
      if (user.blockedUsers.length > 0) {
        continue;
      }

      // Check privacy settings
      const privacy = user.privacySettings;
      if (privacy) {
        if (!privacy.discoverableByNexaVoiceId && user.nexaVoiceId.toLowerCase().includes(cleanQuery.toLowerCase())) {
          // If query only matched NexaVoice ID and discovery is off, skip
          if (!user.username.toLowerCase().includes(cleanQuery.toLowerCase()) && !user.displayName.toLowerCase().includes(cleanQuery.toLowerCase())) {
            continue;
          }
        }
        if (!privacy.discoverableByUsername && user.username.toLowerCase().includes(cleanQuery.toLowerCase())) {
          // If query only matched username and discovery is off, skip
          if (!user.displayName.toLowerCase().includes(cleanQuery.toLowerCase())) {
            continue;
          }
        }
      }

      const isBlockedByCaller = user.blockedByUsers.length > 0;
      let relStatus: ContactRelationshipStatus | undefined = undefined;

      if (user.sentContactRequests.length > 0) {
        relStatus = user.sentContactRequests[0].status as ContactRelationshipStatus;
      } else if (user.receivedContactRequests.length > 0) {
        relStatus = user.receivedContactRequests[0].status as ContactRelationshipStatus;
      }

      results.push({
        id: user.id,
        nexaVoiceId: user.nexaVoiceId,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl || undefined,
        relationshipStatus: relStatus,
        isBlocked: isBlockedByCaller,
      });
    }

    return results;
  }

  /**
   * Privacy-preserving Address Book Synchronization.
   * Matches client-supplied SHA-256 hashes against registered users whose
   * privacy settings explicitly allow phone/email discovery.
   * Never stores raw address books!
   */
  async syncAddressBook(
    userId: string,
    input: SyncAddressBookInput,
  ): Promise<AddressBookMatchResultGql[]> {
    if (!input.entries || input.entries.length === 0) {
      return [];
    }

    // Limit to max 500 entries per batch to prevent abuse
    const entries = input.entries.slice(0, 500);
    const hashes = new Set(entries.map((e) => e.identifierHash.toLowerCase()));

    // Get all users who have opted into email or phone discovery
    const optInUsers = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        privacySettings: {
          OR: [{ discoverableByEmail: true }, { discoverableByPhone: true }],
        },
      },
      include: {
        privacySettings: true,
        blockedUsers: { where: { blockedId: userId } },
      },
    });

    const matchResults: AddressBookMatchResultGql[] = [];

    for (const user of optInUsers) {
      if (user.blockedUsers.length > 0) continue; // Blocked check

      // Compute sha256 for user email if permitted
      if (user.privacySettings?.discoverableByEmail && user.email) {
        const emailHash = crypto
          .createHash('sha256')
          .update(user.email.trim().toLowerCase())
          .digest('hex');

        if (hashes.has(emailHash)) {
          matchResults.push({
            identifierHash: emailHash,
            matchedUser: {
              id: user.id,
              nexaVoiceId: user.nexaVoiceId,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl || undefined,
            },
          });
        }
      }

      // Compute sha256 for user phone if permitted
      if (user.privacySettings?.discoverableByPhone && user.phone) {
        const phoneClean = user.phone.replace(/[^0-9+]/g, '');
        const phoneHash = crypto
          .createHash('sha256')
          .update(phoneClean)
          .digest('hex');

        if (hashes.has(phoneHash)) {
          matchResults.push({
            identifierHash: phoneHash,
            matchedUser: {
              id: user.id,
              nexaVoiceId: user.nexaVoiceId,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl || undefined,
            },
          });
        }
      }
    }

    await this.securityAudit.logEvent({
      actorId: userId,
      action: 'ADDRESS_BOOK_SYNCED',
      result: 'SUCCESS',
      metadata: {
        submittedEntriesCount: entries.length,
        matchedCount: matchResults.length,
      },
    });

    return matchResults;
  }

  /**
   * Creates a user-defined contact group (e.g. Favorites, Team, Clients).
   */
  async createContactGroup(
    userId: string,
    input: CreateContactGroupInput,
  ): Promise<ContactGroupGql> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('Contact group name cannot be empty');
    }

    const existing = await this.prisma.contactGroup.findUnique({
      where: {
        userId_name: { userId, name },
      },
    });

    if (existing) {
      throw new ConflictException(`Contact group '${name}' already exists`);
    }

    const group = await this.prisma.contactGroup.create({
      data: {
        userId,
        name,
        color: input.color,
      },
      include: {
        members: {
          include: { contactUser: true },
        },
      },
    });

    return this.mapContactGroup(group);
  }

  /**
   * Retrieves all contact groups for a user.
   */
  async getContactGroups(userId: string): Promise<ContactGroupGql[]> {
    const groups = await this.prisma.contactGroup.findMany({
      where: { userId },
      include: {
        members: {
          include: { contactUser: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return groups.map((g) => this.mapContactGroup(g));
  }

  /**
   * Adds a contact to a group.
   */
  async addContactToGroup(
    userId: string,
    input: AddContactToGroupInput,
  ): Promise<ContactGroupGql> {
    const group = await this.prisma.contactGroup.findUnique({
      where: { id: input.groupId },
    });

    if (!group || group.userId !== userId) {
      throw new NotFoundException('Contact group not found');
    }

    // Verify target user is an accepted contact
    const contact = await this.prisma.contactRelationship.findFirst({
      where: {
        status: ContactRelationshipStatus.ACCEPTED,
        OR: [
          { requesterId: userId, recipientId: input.contactUserId },
          { requesterId: input.contactUserId, recipientId: userId },
        ],
      },
    });

    if (!contact) {
      throw new BadRequestException('User must be an accepted contact before adding to a group');
    }

    await this.prisma.contactGroupMember.upsert({
      where: {
        groupId_contactUserId: {
          groupId: input.groupId,
          contactUserId: input.contactUserId,
        },
      },
      create: {
        groupId: input.groupId,
        contactUserId: input.contactUserId,
      },
      update: {},
    });

    const updated = await this.prisma.contactGroup.findUniqueOrThrow({
      where: { id: input.groupId },
      include: {
        members: {
          include: { contactUser: true },
        },
      },
    });

    return this.mapContactGroup(updated);
  }

  /**
   * Removes a contact from a group.
   */
  async removeContactFromGroup(
    userId: string,
    groupId: string,
    contactUserId: string,
  ): Promise<ContactGroupGql> {
    const group = await this.prisma.contactGroup.findUnique({
      where: { id: groupId },
    });

    if (!group || group.userId !== userId) {
      throw new NotFoundException('Contact group not found');
    }

    await this.prisma.contactGroupMember.deleteMany({
      where: {
        groupId,
        contactUserId,
      },
    });

    const updated = await this.prisma.contactGroup.findUniqueOrThrow({
      where: { id: groupId },
      include: {
        members: {
          include: { contactUser: true },
        },
      },
    });

    return this.mapContactGroup(updated);
  }

  /**
   * Deletes a contact group.
   */
  async deleteContactGroup(userId: string, groupId: string): Promise<boolean> {
    const group = await this.prisma.contactGroup.findUnique({
      where: { id: groupId },
    });

    if (!group || group.userId !== userId) {
      throw new NotFoundException('Contact group not found');
    }

    await this.prisma.contactGroup.delete({
      where: { id: groupId },
    });

    return true;
  }

  /**
   * Toggles favorite status for a contact.
   */
  async toggleFavorite(userId: string, contactUserId: string): Promise<boolean> {
    let favoritesGroup = await this.prisma.contactGroup.findUnique({
      where: {
        userId_name: { userId, name: 'Favorites' },
      },
    });

    if (!favoritesGroup) {
      favoritesGroup = await this.prisma.contactGroup.create({
        data: {
          userId,
          name: 'Favorites',
          color: '#eab308',
        },
      });
    }

    const existingMember = await this.prisma.contactGroupMember.findUnique({
      where: {
        groupId_contactUserId: {
          groupId: favoritesGroup.id,
          contactUserId,
        },
      },
    });

    if (existingMember) {
      await this.prisma.contactGroupMember.delete({
        where: { id: existingMember.id },
      });
      return false;
    } else {
      await this.addContactToGroup(userId, {
        groupId: favoritesGroup.id,
        contactUserId,
      });
      return true;
    }
  }

  /**
   * Organization Directory: returns members of the caller's organization.
   */
  async getOrganizationDirectory(
    callerId: string,
    input?: OrganizationDirectoryInput,
  ): Promise<OrganizationMemberGql[]> {
    const caller = await this.prisma.user.findUnique({
      where: { id: callerId },
      select: { organizationId: true },
    });

    const orgId = input?.organizationId || caller?.organizationId || 'org_default';

    const whereClause: Record<string, unknown> = {
      organizationId: orgId,
      accountState: 'ACTIVE',
    };

    if (input?.department) {
      whereClause['department'] = { equals: input.department, mode: 'insensitive' };
    }

    if (input?.search) {
      const clean = input.search.trim();
      whereClause['OR'] = [
        { displayName: { contains: clean, mode: 'insensitive' } },
        { username: { contains: clean, mode: 'insensitive' } },
        { department: { contains: clean, mode: 'insensitive' } },
        { jobTitle: { contains: clean, mode: 'insensitive' } },
      ];
    }

    const members = await this.prisma.user.findMany({
      where: whereClause,
      take: Math.min(input?.limit || 50, 100),
      skip: input?.offset || 0,
      orderBy: [{ department: 'asc' }, { displayName: 'asc' }],
    });

    return members.map((m) => ({
      userId: m.id,
      organizationId: m.organizationId || orgId,
      displayName: m.displayName,
      username: m.username,
      email: m.email || undefined,
      department: m.department || undefined,
      jobTitle: m.jobTitle || undefined,
      avatarUrl: m.avatarUrl || undefined,
      status: m.status,
    }));
  }

  private mapContactGroup(group: any): ContactGroupGql {
    return {
      id: group.id,
      userId: group.userId,
      name: group.name,
      color: group.color || undefined,
      memberCount: group.members?.length || 0,
      members: (group.members || []).map((m: any) => ({
        id: m.id,
        contactUserId: m.contactUserId,
        addedAt: m.addedAt.toISOString(),
        contactUser: {
          id: m.contactUser.id,
          nexaVoiceId: m.contactUser.nexaVoiceId,
          username: m.contactUser.username,
          displayName: m.contactUser.displayName,
          avatarUrl: m.contactUser.avatarUrl || undefined,
        },
      })),
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }
}
