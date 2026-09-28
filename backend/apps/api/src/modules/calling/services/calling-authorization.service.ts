import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuthorizationDecisionService } from '../../authorization/authorization-decision.service';
import { RbacService } from '../../authorization/rbac.service';
import {
  AccountState,
  PermissionAction,
  ParticipantRole,
} from '@nexavoice/domain-types';
import {
  CallNotFoundException,
  CallAuthorizationException,
  CallParticipantLimitExceededException,
} from '../exceptions/calling.exceptions';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

@Injectable()
export class CallingAuthorizationService {
  private readonly logger = new StructuredLogger('CallingAuthorizationService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly authDecisionService: AuthorizationDecisionService,
    private readonly rbacService: RbacService,
  ) {}

  /**
   * Asserts that a user has access to view a call session (must be host or participant).
   * Prevents IDOR vulnerabilities.
   */
  async assertCanAccessCall(userId: string, callId: string) {
    const call = await this.prisma.callSession.findUnique({
      where: { id: callId },
      include: {
        participants: {
          select: { userId: true },
        },
      },
    });

    if (!call) {
      throw new CallNotFoundException(callId);
    }

    const isHost = call.hostUserId === userId;
    const isParticipant = call.participants.some((p) => p.userId === userId);

    if (!isHost && !isParticipant) {
      this.logger.warn({
        event: 'call_access_denied_idor',
        callId,
        userId,
      });
      throw new CallAuthorizationException(
        'Forbidden: You are not authorized to access this call session',
      );
    }

    return call;
  }

  /**
   * Asserts that a user can join a call (checks account status, permissions, and capacity).
   */
  async assertCanJoinCall(userId: string, callId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, accountState: true, nexaVoiceId: true },
    });

    if (!user || user.accountState === AccountState.SUSPENDED || user.accountState === AccountState.LOCKED) {
      throw new CallAuthorizationException('Account is not eligible to join calls');
    }

    const call = await this.prisma.callSession.findUnique({
      where: { id: callId },
      include: {
        participants: {
          where: {
            state: { in: ['INVITED', 'RINGING', 'JOINED', 'CONNECTED', 'MUTED', 'ON_HOLD'] },
          },
        },
      },
    });

    if (!call) {
      throw new CallNotFoundException(callId);
    }

    // Check participant limit
    const activeCount = call.participants.filter(
      (p) => p.state === 'JOINED' || p.state === 'CONNECTED' || p.state === 'MUTED' || p.state === 'ON_HOLD',
    ).length;

    if (activeCount >= call.maxParticipants) {
      throw new CallParticipantLimitExceededException(call.maxParticipants, activeCount);
    }

    // Check ABAC / RBAC
    const userPerms = await this.rbacService.getUserPermissions(userId);
    const decision = await this.authDecisionService.authorize({
      subject: {
        id: userId,
        nexaVoiceId: user.nexaVoiceId,
        accountState: user.accountState as AccountState,
        roles: userPerms.roles,
        permissions: userPerms.permissions,
      },
      action: PermissionAction.CALL_JOIN,
      resource: {
        type: 'CallSession',
        id: callId,
      },
    });

    if (!decision.allowed) {
      throw new CallAuthorizationException(`Join denied: ${decision.reason}`);
    }

    return call;
  }

  /**
   * Asserts that actor has permission to end the call (must be host or have CALL_END permission).
   */
  async assertCanEndCall(actorId: string, callId: string) {
    const call = await this.prisma.callSession.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new CallNotFoundException(callId);
    }

    if (call.hostUserId === actorId) {
      return call; // Call creator/host can always end
    }

    const userPerms = await this.rbacService.getUserPermissions(actorId);
    if (userPerms.permissions.includes(PermissionAction.CALL_END)) {
      return call;
    }

    throw new CallAuthorizationException('Forbidden: Only the call host or authorized moderator can end the call');
  }

  /**
   * Asserts that actor has permission to mute a participant.
   * A user can always mute themselves. Muting others requires HOST/CO_HOST role or canMuteOthers permission.
   */
  async assertCanMuteParticipant(actorId: string, callId: string, targetUserId: string) {
    if (actorId === targetUserId) {
      return true; // Self mute is always permitted
    }

    const actorParticipant = await this.prisma.callParticipant.findUnique({
      where: {
        callSessionId_userId: {
          callSessionId: callId,
          userId: actorId,
        },
      },
    });

    if (!actorParticipant) {
      throw new CallAuthorizationException('Actor is not a participant in this call');
    }

    if (
      actorParticipant.role === ParticipantRole.HOST ||
      actorParticipant.role === ParticipantRole.CO_HOST ||
      actorParticipant.canMuteOthers
    ) {
      return true;
    }

    throw new CallAuthorizationException('Forbidden: You do not have permission to mute other participants');
  }

  /**
   * Asserts that actor has permission to remove a participant.
   */
  async assertCanRemoveParticipant(actorId: string, callId: string, targetUserId: string) {
    if (actorId === targetUserId) {
      return true; // Leaving self
    }

    const actorParticipant = await this.prisma.callParticipant.findUnique({
      where: {
        callSessionId_userId: {
          callSessionId: callId,
          userId: actorId,
        },
      },
    });

    if (!actorParticipant) {
      throw new CallAuthorizationException('Actor is not a participant in this call');
    }

    if (
      actorParticipant.role === ParticipantRole.HOST ||
      actorParticipant.role === ParticipantRole.CO_HOST ||
      actorParticipant.canRemoveParticipants
    ) {
      return true;
    }

    throw new CallAuthorizationException('Forbidden: You do not have permission to remove participants from this call');
  }

  /**
   * Asserts that a user can swap between two calls (Call A and Call B).
   * Validates membership in both calls and that one is ACTIVE while the other is HELD.
   */
  async assertCanSwapCalls(userId: string, callAId: string, callBId: string) {
    if (callAId === callBId) {
      throw new CallAuthorizationException('Cannot swap a call with itself');
    }

    const [callA, callB] = await Promise.all([
      this.prisma.callSession.findUnique({
        where: { id: callAId },
        include: { participants: { where: { userId } } },
      }),
      this.prisma.callSession.findUnique({
        where: { id: callBId },
        include: { participants: { where: { userId } } },
      }),
    ]);

    if (!callA) throw new CallNotFoundException(callAId);
    if (!callB) throw new CallNotFoundException(callBId);

    if (callA.participants.length === 0 || callB.participants.length === 0) {
      throw new CallAuthorizationException('Forbidden: User is not an active participant in both calls');
    }

    const statusA = callA.status as string;
    const statusB = callB.status as string;

    const validSwap = (statusA === 'ACTIVE' && statusB === 'HELD') || (statusA === 'HELD' && statusB === 'ACTIVE');
    if (!validSwap) {
      throw new CallAuthorizationException(
        `Cannot swap calls: One call must be ACTIVE and the other HELD (Call A is '${statusA}', Call B is '${statusB}')`,
      );
    }

    return { callA, callB };
  }

  /**
   * Asserts that actor has permission to transfer a call.
   */
  async assertCanTransferCall(actorId: string, callId: string, targetUserId: string) {
    if (actorId === targetUserId) {
      throw new CallAuthorizationException('Cannot transfer a call to yourself');
    }

    await this.assertCanAccessCall(actorId, callId);

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, accountState: true },
    });

    if (!targetUser || targetUser.accountState === AccountState.SUSPENDED || targetUser.accountState === AccountState.LOCKED) {
      throw new CallAuthorizationException('Transfer target user is invalid or suspended');
    }

    return targetUser;
  }

  /**
   * Asserts that actor can merge two calls into a conference.
   */
  async assertCanMergeCalls(actorId: string, callAId: string, callBId: string) {
    if (callAId === callBId) {
      throw new CallAuthorizationException('Cannot merge a call with itself');
    }

    const [callA, callB] = await Promise.all([
      this.prisma.callSession.findUnique({
        where: { id: callAId },
        include: { participants: { where: { state: { in: ['JOINED', 'CONNECTED', 'ON_HOLD', 'MUTED'] } } } },
      }),
      this.prisma.callSession.findUnique({
        where: { id: callBId },
        include: { participants: { where: { state: { in: ['JOINED', 'CONNECTED', 'ON_HOLD', 'MUTED'] } } } },
      }),
    ]);

    if (!callA) throw new CallNotFoundException(callAId);
    if (!callB) throw new CallNotFoundException(callBId);

    const inA = callA.participants.some((p) => p.userId === actorId);
    const inB = callB.participants.some((p) => p.userId === actorId);

    if (!inA || !inB) {
      throw new CallAuthorizationException('Forbidden: Actor must be a participant in both calls to merge them');
    }

    // Combine distinct participants
    const uniqueUserIds = new Set([
      ...callA.participants.map((p) => p.userId),
      ...callB.participants.map((p) => p.userId),
    ]);

    if (uniqueUserIds.size > 100) {
      throw new CallParticipantLimitExceededException(100, uniqueUserIds.size);
    }

    return { callA, callB, combinedUserIds: Array.from(uniqueUserIds) };
  }

  /**
   * Asserts that actor can moderate a conference.
   */
  async assertCanModerateConference(actorId: string, callId: string) {
    const participant = await this.prisma.callParticipant.findUnique({
      where: {
        callSessionId_userId: {
          callSessionId: callId,
          userId: actorId,
        },
      },
    });

    if (!participant) {
      throw new CallAuthorizationException('Actor is not a participant in this call');
    }

    if (participant.role !== ParticipantRole.HOST && participant.role !== ParticipantRole.CO_HOST) {
      throw new CallAuthorizationException('Forbidden: Only hosts or moderators can perform conference moderation');
    }

    return participant;
  }

  /**
   * Asserts that actor can perform a device handoff.
   * Revalidates that targetDeviceId is an active trusted device belonging to actorId.
   */
  async assertCanHandoffCall(actorId: string, callId: string, targetDeviceId: string) {
    await this.assertCanAccessCall(actorId, callId);

    const targetDevice = await this.prisma.device.findFirst({
      where: {
        userId: actorId,
        deviceId: targetDeviceId,
      },
    });

    if (!targetDevice) {
      this.logger.warn({
        event: 'device_handoff_unauthorized_device',
        actorId,
        callId,
        targetDeviceId,
      });
      throw new CallAuthorizationException(
        'Forbidden: Target device does not belong to authorized user account',
      );
    }

    return targetDevice;
  }

  /**
   * Asserts that actor can start recording a call.
   */
  async assertCanStartRecording(actorId: string, callId: string) {
    const call = await this.assertCanAccessCall(actorId, callId);

    if (call.roomId) {
      const room = await this.prisma.callRoom.findUnique({
        where: { id: call.roomId },
      });
      if (room && !room.allowRecording) {
        throw new CallAuthorizationException('Recording is disabled by room policy');
      }
    }

    const participant = await this.prisma.callParticipant.findUnique({
      where: {
        callSessionId_userId: {
          callSessionId: callId,
          userId: actorId,
        },
      },
    });

    if (!participant) {
      throw new CallAuthorizationException('Actor is not a participant in this call');
    }

    if (
      participant.role !== ParticipantRole.HOST &&
      participant.role !== ParticipantRole.CO_HOST &&
      !participant.canRecord
    ) {
      throw new CallAuthorizationException('Forbidden: You do not have permission to record this call');
    }

    return call;
  }

  /**
   * Asserts that actor can access a recording (IDOR protection).
   */
  async assertCanAccessRecording(actorId: string, recordingId: string) {
    const recording = await this.prisma.recordingSession.findUnique({
      where: { id: recordingId },
      include: {
        callSession: {
          include: {
            participants: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!recording) {
      throw new CallNotFoundException(`Recording session '${recordingId}' not found`);
    }

    const isInitiator = recording.initiatorUserId === actorId;
    const isHost = recording.callSession.hostUserId === actorId;
    const isParticipant = recording.callSession.participants.some((p) => p.userId === actorId);

    if (!isInitiator && !isHost && !isParticipant) {
      this.logger.warn({
        event: 'recording_access_denied_idor',
        recordingId,
        actorId,
      });
      throw new CallAuthorizationException(
        'Forbidden: You are not authorized to access this recording session',
      );
    }

    return recording;
  }
}

