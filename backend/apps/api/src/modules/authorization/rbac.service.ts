import { Injectable, OnModuleInit } from '@nestjs/common';
import { PermissionAction, SystemRole } from '@nexavoice/domain-types';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service';
import { SecurityAuditService } from '../security/security-audit.service';

/**
 * Default role-to-permission baseline mappings.
 */
export const ROLE_PERMISSIONS_MAP: Record<SystemRole, PermissionAction[]> = {
  [SystemRole.USER]: [
    PermissionAction.IDENTITY_READ,
    PermissionAction.IDENTITY_UPDATE,
    PermissionAction.PROFILE_READ,
    PermissionAction.PROFILE_UPDATE,
    PermissionAction.CONTACT_READ,
    PermissionAction.CONTACT_MANAGE,
    PermissionAction.CONVERSATION_READ,
    PermissionAction.CONVERSATION_WRITE,
    PermissionAction.MESSAGE_READ,
    PermissionAction.MESSAGE_SEND,
    PermissionAction.MESSAGE_EDIT,
    PermissionAction.MESSAGE_DELETE,
    PermissionAction.CALL_JOIN,
    PermissionAction.CALL_INVITE,
    PermissionAction.CALL_END,
    PermissionAction.RECORDING_START,
    PermissionAction.RECORDING_STOP,
    PermissionAction.AI_READ,
    PermissionAction.AI_CONFIGURE,
    PermissionAction.AI_LISTEN,
    PermissionAction.AI_SPEAK,
    PermissionAction.AI_JOIN_CALL,
    PermissionAction.AI_SEND_MESSAGE,
    PermissionAction.AI_MAKE_CALL,
    PermissionAction.AI_TRANSFER_CALL,
    PermissionAction.AI_END_CALL,
    PermissionAction.SECURITY_MANAGE_SESSIONS,
  ],
  [SystemRole.ROOM_HOST]: [
    PermissionAction.CALL_REMOVE_PARTICIPANT,
    PermissionAction.CALL_MUTE_PARTICIPANT,
    PermissionAction.CALL_TRANSFER,
  ],
  [SystemRole.MODERATOR]: [
    PermissionAction.MESSAGE_DELETE,
    PermissionAction.CALL_REMOVE_PARTICIPANT,
    PermissionAction.CALL_MUTE_PARTICIPANT,
  ],
  [SystemRole.COMMUNITY_ADMIN]: [
    PermissionAction.CONVERSATION_DELETE,
    PermissionAction.MESSAGE_DELETE,
    PermissionAction.CALL_REMOVE_PARTICIPANT,
  ],
  [SystemRole.DEVELOPER]: [
    PermissionAction.IDENTITY_READ,
  ],
  [SystemRole.SUPPORT_AGENT]: [
    PermissionAction.IDENTITY_READ,
    PermissionAction.PROFILE_READ,
  ],
  [SystemRole.SECURITY_ADMIN]: [
    PermissionAction.SECURITY_VIEW_AUDIT,
    PermissionAction.SECURITY_MANAGE_SESSIONS,
  ],
  [SystemRole.SYSTEM_ADMIN]: Object.values(PermissionAction),
};

@Injectable()
export class RbacService implements OnModuleInit {
  private readonly logger = new StructuredLogger('RbacService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  async onModuleInit() {
    if (this.prisma.isDatabaseConnected()) {
      await this.ensureBaselineRolesAndPermissions();
    }
  }

  /**
   * Initializes baseline system roles and permissions if they do not exist.
   */
  async ensureBaselineRolesAndPermissions(): Promise<void> {
    try {
      // 1. Seed all PermissionAction enum items
      for (const action of Object.values(PermissionAction)) {
        const [module] = action.split('.');
        await this.prisma.permission.upsert({
          where: { action },
          create: {
            action,
            module: module || 'core',
            description: `Capability for ${action}`,
          },
          update: {},
        });
      }

      // 2. Seed all SystemRole enum items and their RolePermission mappings
      for (const roleName of Object.values(SystemRole)) {
        const role = await this.prisma.role.upsert({
          where: { name: roleName },
          create: {
            name: roleName,
            isSystem: true,
            description: `System role for ${roleName}`,
          },
          update: {},
        });

        const actions = ROLE_PERMISSIONS_MAP[roleName] || [];
        for (const action of actions) {
          const perm = await this.prisma.permission.findUnique({ where: { action } });
          if (perm) {
            await this.prisma.rolePermission.upsert({
              where: {
                roleId_permissionId: {
                  roleId: role.id,
                  permissionId: perm.id,
                },
              },
              create: {
                roleId: role.id,
                permissionId: perm.id,
              },
              update: {},
            });
          }
        }
      }
      this.logger.log('Baseline RBAC roles and permissions verified');
    } catch (err) {
      this.logger.warn({
        message: 'Could not sync baseline RBAC roles at startup',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Resolves effective roles and permission action strings for a user.
   */
  async getUserPermissions(userId: string): Promise<{ roles: string[]; permissions: string[] }> {
    if (!this.prisma.isDatabaseConnected()) {
      // Offline fallback: provide baseline USER role permissions
      return {
        roles: [SystemRole.USER],
        permissions: ROLE_PERMISSIONS_MAP[SystemRole.USER] || [],
      };
    }

    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const rolesSet = new Set<string>();
    const permissionsSet = new Set<string>();

    // If user has no specific assignments, ensure standard USER role
    if (assignments.length === 0) {
      rolesSet.add(SystemRole.USER);
      (ROLE_PERMISSIONS_MAP[SystemRole.USER] || []).forEach((p) => permissionsSet.add(p));
    } else {
      for (const assignment of assignments) {
        rolesSet.add(assignment.role.name);
        for (const rp of assignment.role.permissions) {
          permissionsSet.add(rp.permission.action);
        }
      }
    }

    return {
      roles: Array.from(rolesSet),
      permissions: Array.from(permissionsSet),
    };
  }

  /**
   * Assigns a role to a user.
   */
  async assignRoleToUser(userId: string, roleName: SystemRole, assignedBy?: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      throw new Error(`Role ${roleName} does not exist`);
    }

    await this.prisma.userRoleAssignment.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id,
        },
      },
      create: {
        userId,
        roleId: role.id,
        assignedBy,
      },
      update: {},
    });

    await this.securityAudit.logEvent({
      actorId: assignedBy,
      action: 'ROLE_ASSIGNED',
      targetType: 'User',
      targetId: userId,
      result: 'SUCCESS',
      metadata: { roleName },
    });
  }

  /**
   * Revokes a role from a user.
   */
  async revokeRoleFromUser(userId: string, roleName: SystemRole, revokedBy?: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) return;

    await this.prisma.userRoleAssignment.deleteMany({
      where: { userId, roleId: role.id },
    });

    await this.securityAudit.logEvent({
      actorId: revokedBy,
      action: 'ROLE_REVOKED',
      targetType: 'User',
      targetId: userId,
      result: 'SUCCESS',
      metadata: { roleName },
    });
  }
}
