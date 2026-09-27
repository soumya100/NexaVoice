import { Injectable } from '@nestjs/common';
import {
  AccountState,
  AuthorizationDecision,
  AuthorizationSubject,
  PermissionAction,
  SystemRole,
} from '@nexavoice/domain-types';
import { SecurityAuditService } from '../security/security-audit.service';

export interface AuthorizeRequest {
  subject: AuthorizationSubject;
  action: PermissionAction | string;
  resource?: {
    type: string;
    id: string;
    ownerId?: string;
    participantIds?: string[];
    isLocked?: boolean;
    legalHold?: boolean;
  };
  context?: {
    isHost?: boolean;
    isModerator?: boolean;
    approvedByHuman?: boolean;
    confidenceScore?: number;
    ipAddress?: string;
    deviceId?: string;
  };
}

@Injectable()
export class AuthorizationDecisionService {
  private readonly policyVersion = '2026-09.v1';

  constructor(private readonly securityAudit: SecurityAuditService) {}

  /**
   * Central authorization evaluation method incorporating RBAC, ABAC, Resource Ownership, and AI safety policies.
   */
  async authorize(request: AuthorizeRequest): Promise<AuthorizationDecision> {
    const { subject, action, resource, context } = request;
    const evaluatedAt = new Date().toISOString();

    // 1. Account State Boundary Check
    if (subject.accountState !== AccountState.ACTIVE) {
      await this.auditDenial(subject, action, 'ACCOUNT_NOT_ACTIVE');
      return {
        allowed: false,
        reason: `Account state is ${subject.accountState}; operations restricted.`,
        policyVersion: this.policyVersion,
        evaluatedAt,
      };
    }

    // 2. System Admin Override
    if (subject.roles.includes(SystemRole.SYSTEM_ADMIN)) {
      return {
        allowed: true,
        reason: 'SYSTEM_ADMIN_ROLE_GRANTED',
        policyVersion: this.policyVersion,
        evaluatedAt,
      };
    }

    // 3. RBAC Coarse-Grained Permission Check
    const hasPermission = subject.permissions.includes(action as PermissionAction);
    if (!hasPermission) {
      await this.auditDenial(subject, action, 'MISSING_REQUIRED_PERMISSION');
      return {
        allowed: false,
        reason: 'Subject lacks required capability permission',
        policyVersion: this.policyVersion,
        evaluatedAt,
      };
    }

    // 4. Resource-Level ABAC Policies
    if (resource) {
      // 4.1 Legal Hold Check on sensitive operations (e.g. recording deletion, audit purge)
      if (resource.legalHold && (action === PermissionAction.RECORDING_DELETE || action.includes('delete'))) {
        await this.auditDenial(subject, action, 'RESOURCE_LEGAL_HOLD');
        return {
          allowed: false,
          reason: 'Resource is protected under active legal hold.',
          policyVersion: this.policyVersion,
          evaluatedAt,
        };
      }

      // 4.2 Resource Ownership Check
      const isOwner = resource.ownerId === subject.id;
      const isModerator =
        subject.roles.includes(SystemRole.MODERATOR) ||
        subject.roles.includes(SystemRole.COMMUNITY_ADMIN) ||
        context?.isModerator === true;

      // Ownership-bound actions
      if (
        (action === PermissionAction.IDENTITY_UPDATE ||
          action === PermissionAction.PROFILE_UPDATE ||
          action === PermissionAction.MESSAGE_EDIT) &&
        !isOwner
      ) {
        await this.auditDenial(subject, action, 'RESOURCE_OWNERSHIP_VIOLATION');
        return {
          allowed: false,
          reason: 'Subject is not the owner of this resource.',
          policyVersion: this.policyVersion,
          evaluatedAt,
        };
      }

      // Deletion actions (Owner or Authorized Moderator)
      if (action === PermissionAction.MESSAGE_DELETE && !isOwner && !isModerator) {
        await this.auditDenial(subject, action, 'NOT_AUTHORIZED_TO_DELETE');
        return {
          allowed: false,
          reason: 'Requires message ownership or moderator capability.',
          policyVersion: this.policyVersion,
          evaluatedAt,
        };
      }

      // 4.3 Conversation & Group Membership Check
      if (resource.participantIds && !resource.participantIds.includes(subject.id) && !isModerator) {
        await this.auditDenial(subject, action, 'NOT_A_CONVERSATION_PARTICIPANT');
        return {
          allowed: false,
          reason: 'Subject is not a participant in this conversation.',
          policyVersion: this.policyVersion,
          evaluatedAt,
        };
      }

      // 4.4 Call Control Capabilities
      if (
        (action === PermissionAction.CALL_REMOVE_PARTICIPANT || action === PermissionAction.CALL_MUTE_PARTICIPANT) &&
        !isOwner &&
        !context?.isHost &&
        !isModerator
      ) {
        await this.auditDenial(subject, action, 'CALL_HOST_CAPABILITY_REQUIRED');
        return {
          allowed: false,
          reason: 'Only call hosts or moderators can remove or mute participants.',
          policyVersion: this.policyVersion,
          evaluatedAt,
        };
      }
    }

    // 5. AI Assistant Specific Safety Policy
    if (action.startsWith('ai.')) {
      const highImpactAiActions = [
        PermissionAction.AI_MAKE_CALL,
        PermissionAction.AI_TRANSFER_CALL,
        PermissionAction.AI_END_CALL,
      ];

      // High-impact AI actions require explicit human confirmation
      if (highImpactAiActions.includes(action as PermissionAction) && !context?.approvedByHuman) {
        await this.auditDenial(subject, action, 'AI_HUMAN_APPROVAL_REQUIRED');
        return {
          allowed: false,
          reason: 'High-impact AI action requires explicit human confirmation.',
          policyVersion: this.policyVersion,
          evaluatedAt,
          obligations: ['REQUIRE_HUMAN_CONFIRMATION_FLOW'],
        };
      }
    }

    // 6. Authorized
    return {
      allowed: true,
      reason: 'POLICY_SATISFIED',
      policyVersion: this.policyVersion,
      evaluatedAt,
    };
  }

  private async auditDenial(subject: AuthorizationSubject, action: string, reason: string): Promise<void> {
    await this.securityAudit.logEvent({
      actorId: subject.id,
      action: 'AUTHORIZATION_DENIED',
      result: 'DENIED',
      reason,
      metadata: { requestedAction: action },
    });
  }
}
