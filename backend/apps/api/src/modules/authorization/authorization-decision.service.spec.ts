import { Test, TestingModule } from '@nestjs/testing';
import {
  AccountState,
  AuthorizationSubject,
  PermissionAction,
  SystemRole,
} from '@nexavoice/domain-types';
import { AuthorizationDecisionService } from './authorization-decision.service';
import { SecurityAuditService } from '../security/security-audit.service';

describe('AuthorizationDecisionService', () => {
  let service: AuthorizationDecisionService;
  let mockSecurityAudit: Partial<SecurityAuditService>;

  const activeSubject: AuthorizationSubject = {
    id: 'user-1',
    nexaVoiceId: 'NV-1000-2000',
    accountState: AccountState.ACTIVE,
    roles: [SystemRole.USER],
    permissions: [
      PermissionAction.IDENTITY_UPDATE,
      PermissionAction.CONVERSATION_READ,
      PermissionAction.MESSAGE_DELETE,
      PermissionAction.CALL_REMOVE_PARTICIPANT,
      PermissionAction.RECORDING_DELETE,
      PermissionAction.AI_MAKE_CALL,
    ],
  };

  beforeEach(async () => {
    mockSecurityAudit = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthorizationDecisionService,
        { provide: SecurityAuditService, useValue: mockSecurityAudit },
      ],
    }).compile();

    service = module.get<AuthorizationDecisionService>(AuthorizationDecisionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should deny authorization if user account state is SUSPENDED', async () => {
    const suspendedSubject: AuthorizationSubject = {
      ...activeSubject,
      accountState: AccountState.SUSPENDED,
    };

    const decision = await service.authorize({
      subject: suspendedSubject,
      action: PermissionAction.CONVERSATION_READ,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('SUSPENDED');
    expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTHORIZATION_DENIED', result: 'DENIED' }),
    );
  });

  it('should allow SYSTEM_ADMIN regardless of permissions', async () => {
    const adminSubject: AuthorizationSubject = {
      id: 'admin-1',
      nexaVoiceId: 'NV-9999-9999',
      accountState: AccountState.ACTIVE,
      roles: [SystemRole.SYSTEM_ADMIN],
      permissions: [],
    };

    const decision = await service.authorize({
      subject: adminSubject,
      action: PermissionAction.RECORDING_DELETE,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('SYSTEM_ADMIN_ROLE_GRANTED');
  });

  it('should deny if user lacks required permission', async () => {
    const decision = await service.authorize({
      subject: activeSubject,
      action: PermissionAction.SECURITY_VIEW_AUDIT, // not in activeSubject.permissions
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('lacks required capability');
  });

  it('should allow resource owner to update their own identity', async () => {
    const decision = await service.authorize({
      subject: activeSubject,
      action: PermissionAction.IDENTITY_UPDATE,
      resource: {
        type: 'User',
        id: 'user-1',
        ownerId: 'user-1', // Matches activeSubject.id
      },
    });

    expect(decision.allowed).toBe(true);
  });

  it('should deny non-owner from updating anothers identity', async () => {
    const decision = await service.authorize({
      subject: activeSubject,
      action: PermissionAction.IDENTITY_UPDATE,
      resource: {
        type: 'User',
        id: 'user-2',
        ownerId: 'user-2', // Different owner
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('not the owner');
  });

  it('should enforce conversation participant check', async () => {
    const allowedDecision = await service.authorize({
      subject: activeSubject,
      action: PermissionAction.CONVERSATION_READ,
      resource: {
        type: 'Conversation',
        id: 'conv-100',
        participantIds: ['user-1', 'user-2'],
      },
    });
    expect(allowedDecision.allowed).toBe(true);

    const deniedDecision = await service.authorize({
      subject: activeSubject,
      action: PermissionAction.CONVERSATION_READ,
      resource: {
        type: 'Conversation',
        id: 'conv-200',
        participantIds: ['user-3', 'user-4'], // user-1 not included
      },
    });
    expect(deniedDecision.allowed).toBe(false);
    expect(deniedDecision.reason).toContain('not a participant');
  });

  it('should deny recording deletion when resource is under legal hold', async () => {
    const decision = await service.authorize({
      subject: activeSubject,
      action: PermissionAction.RECORDING_DELETE,
      resource: {
        type: 'Recording',
        id: 'rec-1',
        ownerId: 'user-1',
        legalHold: true,
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('legal hold');
  });

  it('should require human approval for high-impact AI actions', async () => {
    // 1. Without human confirmation -> Denied with obligation
    const unapprovedDecision = await service.authorize({
      subject: activeSubject,
      action: PermissionAction.AI_MAKE_CALL,
      context: { approvedByHuman: false },
    });
    expect(unapprovedDecision.allowed).toBe(false);
    expect(unapprovedDecision.reason).toContain('human confirmation');
    expect(unapprovedDecision.obligations).toContain('REQUIRE_HUMAN_CONFIRMATION_FLOW');

    // 2. With human confirmation -> Allowed
    const approvedDecision = await service.authorize({
      subject: activeSubject,
      action: PermissionAction.AI_MAKE_CALL,
      context: { approvedByHuman: true },
    });
    expect(approvedDecision.allowed).toBe(true);
  });
});
