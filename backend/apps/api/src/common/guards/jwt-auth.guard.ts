import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AccountState, AuthorizationSubject, AuthTokenPayload, SystemRole } from '@nexavoice/domain-types';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RbacService, ROLE_PERMISSIONS_MAP, registerAuthCacheInvalidator } from '../../modules/authorization/rbac.service';
import { RequestPerformanceContext } from '../observability/request-performance.context';

interface CachedSubject {
  accountState: AccountState;
  tokenVersion: number;
  roles: string[];
  permissions: string[];
  expiresAt: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private static readonly subjectCache = new Map<string, CachedSubject>();
  private static readonly CACHE_TTL_MS = 60_000; // 60 seconds TTL

  static {
    registerAuthCacheInvalidator((userId) => JwtAuthGuard.invalidateUser(userId));
  }

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {
    void this.rbacService;
  }

  /**
   * Explicitly evicts a user's cached authorization subject (e.g. on logout or role change).
   */
  static invalidateUser(userId: string): void {
    JwtAuthGuard.subjectCache.delete(userId);
  }

  static clearCache(): void {
    JwtAuthGuard.subjectCache.clear();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const tStart = performance.now();
    const request = this.getRequest(context);
    const authHeader = request?.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication token missing or invalid');
    }

    const token = authHeader.substring(7);

    try {
      const secret = this.configService.get<string>('jwt.secret', 'dev-secret-key-32-chars-long-minimum!');
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token, { secret });

      if (!this.prisma.isDatabaseConnected()) {
        throw new UnauthorizedException('Authentication service degraded: session authority unreachable');
      }

      // Check fast in-memory cache for validated subject
      const cached = JwtAuthGuard.subjectCache.get(payload.sub);
      let accountState: AccountState;
      let roles: string[];
      let permissions: string[];

      if (
        cached &&
        cached.expiresAt > Date.now() &&
        cached.tokenVersion === payload.tokenVersion
      ) {
        accountState = cached.accountState;
        roles = cached.roles;
        permissions = cached.permissions;
      } else if (typeof this.prisma.$queryRaw === 'function') {
        // Cache miss or expired: resolve user, token version, and entire RBAC hierarchy in ONE SQL query
        const rawResults = await this.prisma.$queryRaw<
          Array<{
            id: string;
            accountState: string;
            tokenVersion: number;
            roleName: string | null;
            permissionAction: string | null;
          }>
        >`
          SELECT 
            u.id, 
            u."accountState", 
            u."tokenVersion",
            r.name as "roleName",
            p.action as "permissionAction"
          FROM "User" u
          LEFT JOIN "UserRoleAssignment" ura ON ura."userId" = u.id
          LEFT JOIN "Role" r ON r.id = ura."roleId"
          LEFT JOIN "RolePermission" rp ON rp."roleId" = r.id
          LEFT JOIN "Permission" p ON p.id = rp."permissionId"
          WHERE u.id = ${payload.sub}
        `;

        if (!rawResults || rawResults.length === 0) {
          throw new UnauthorizedException('User account no longer exists');
        }

        const first = rawResults[0];
        if (first.tokenVersion !== payload.tokenVersion) {
          throw new UnauthorizedException('Session token was invalidated; please log in again.');
        }

        accountState = first.accountState as AccountState;
        if (accountState === AccountState.SUSPENDED || accountState === AccountState.LOCKED) {
          throw new UnauthorizedException(`Account is ${accountState}; access denied.`);
        }

        const rolesSet = new Set<string>();
        const permsSet = new Set<string>();

        for (const row of rawResults) {
          if (row.roleName) {
            rolesSet.add(row.roleName);
            const baseline = ROLE_PERMISSIONS_MAP[row.roleName as SystemRole];
            if (baseline) {
              baseline.forEach((p) => permsSet.add(p));
            }
          }
          if (row.permissionAction) {
            permsSet.add(row.permissionAction);
          }
        }

        if (rolesSet.size === 0) {
          rolesSet.add(SystemRole.USER);
          (ROLE_PERMISSIONS_MAP[SystemRole.USER] || []).forEach((p) => permsSet.add(p));
        }

        roles = Array.from(rolesSet);
        permissions = Array.from(permsSet);

        // Populate cache
        JwtAuthGuard.subjectCache.set(payload.sub, {
          accountState,
          tokenVersion: first.tokenVersion,
          roles,
          permissions,
          expiresAt: Date.now() + JwtAuthGuard.CACHE_TTL_MS,
        });

        // Bound cache size
        if (JwtAuthGuard.subjectCache.size > 5000) {
          const oldestKey = JwtAuthGuard.subjectCache.keys().next().value;
          if (oldestKey) JwtAuthGuard.subjectCache.delete(oldestKey);
        }
      } else {
        // Fallback for test harnesses where $queryRaw is unmocked
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: {
            id: true,
            accountState: true,
            tokenVersion: true,
          },
        });

        if (!user) {
          throw new UnauthorizedException('User account no longer exists');
        }

        if (user.tokenVersion !== payload.tokenVersion) {
          throw new UnauthorizedException('Session token was invalidated; please log in again.');
        }

        accountState = user.accountState as AccountState;
        if (accountState === AccountState.SUSPENDED || accountState === AccountState.LOCKED) {
          throw new UnauthorizedException(`Account is ${accountState}; access denied.`);
        }

        const userPerms = await this.rbacService.getUserPermissions(payload.sub);
        roles = userPerms.roles;
        permissions = userPerms.permissions;
      }

      if (accountState === AccountState.SUSPENDED || accountState === AccountState.LOCKED) {
        throw new UnauthorizedException(`Account is ${accountState}; access denied.`);
      }

      const subject: AuthorizationSubject = {
        id: payload.sub,
        nexaVoiceId: payload.nexaVoiceId,
        accountState,
        roles,
        permissions,
        sessionId: payload.sid,
      };

      // Attach subject to request for subsequent guards and resolvers
      request.user = subject;
      request.session = { id: payload.sid };

      const durationMs = performance.now() - tStart;
      RequestPerformanceContext.current()?.recordAuth(durationMs);

      return true;
    } catch (err) {
      const durationMs = performance.now() - tStart;
      RequestPerformanceContext.current()?.recordAuth(durationMs);
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  private getRequest(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    const gqlReq = gqlCtx.getContext()?.req;
    if (gqlReq) {
      return gqlReq;
    }
    return context.switchToHttp().getRequest();
  }
}
