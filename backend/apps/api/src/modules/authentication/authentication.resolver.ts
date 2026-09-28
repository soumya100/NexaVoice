import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthorizationSubject, PermissionAction } from '@nexavoice/domain-types';
import { AuthenticationService } from './authentication.service';
import { SessionService } from './session.service';
import { SecurityAuditService } from '../security/security-audit.service';
import {
  AuthPayloadGql,
  DeviceDtoGql,
  LoginInput,
  PasswordResetResponseGql,
  RegisterInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  SecurityEventDtoGql,
  SessionDtoGql,
  UserProfileGql,
} from './authentication.types';
import { CurrentSession, CurrentUser, Public, RequirePermissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Resolver()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuthenticationResolver {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly sessionService: SessionService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  @Public()
  @Mutation(() => AuthPayloadGql, { description: 'Register a new user account' })
  async register(
    @Args('input') input: RegisterInput,
    @Context() ctx: { req: { ip?: string; headers?: Record<string, string> } },
  ): Promise<AuthPayloadGql> {
    const ipAddress = ctx.req?.ip;
    const userAgent = ctx.req?.headers?.['user-agent'];
    return this.authService.register(input, { ipAddress, userAgent });
  }

  @Public()
  @Mutation(() => AuthPayloadGql, { description: 'Authenticate with credentials' })
  async login(
    @Args('input') input: LoginInput,
    @Context() ctx: { req: { ip?: string; headers?: Record<string, string> } },
  ): Promise<AuthPayloadGql> {
    const ipAddress = ctx.req?.ip;
    const userAgent = ctx.req?.headers?.['user-agent'];
    return this.authService.login(input, { ipAddress, userAgent });
  }

  @Public()
  @Mutation(() => AuthPayloadGql, { description: 'Rotate refresh token and issue new access token' })
  async refreshToken(
    @Args('refreshToken') refreshToken: string,
    @Context() ctx: { req: { ip?: string; headers?: Record<string, string> } },
  ): Promise<AuthPayloadGql> {
    const ipAddress = ctx.req?.ip;
    const userAgent = ctx.req?.headers?.['user-agent'];
    return this.authService.refreshToken(refreshToken, { ipAddress, userAgent });
  }

  @Public()
  @Mutation(() => PasswordResetResponseGql, { description: 'Request password reset instructions sent via email' })
  async requestPasswordReset(
    @Args('input') input: RequestPasswordResetInput,
    @Context() ctx: { req: { ip?: string; headers?: Record<string, string> } },
  ): Promise<PasswordResetResponseGql> {
    const ipAddress = ctx.req?.ip;
    const userAgent = ctx.req?.headers?.['user-agent'];
    return this.authService.requestPasswordReset(input, { ipAddress, userAgent });
  }

  @Public()
  @Mutation(() => PasswordResetResponseGql, { description: 'Reset account password using secure reset token' })
  async resetPassword(
    @Args('input') input: ResetPasswordInput,
    @Context() ctx: { req: { ip?: string; headers?: Record<string, string> } },
  ): Promise<PasswordResetResponseGql> {
    const ipAddress = ctx.req?.ip;
    const userAgent = ctx.req?.headers?.['user-agent'];
    return this.authService.resetPassword(input, { ipAddress, userAgent });
  }

  @Mutation(() => Boolean, { description: 'Logout current session or all active sessions' })
  async logout(
    @CurrentUser() user: AuthorizationSubject,
    @CurrentSession() session: { id: string } | undefined,
    @Args('allSessions', { type: () => Boolean, nullable: true, defaultValue: false }) allSessions: boolean,
  ): Promise<boolean> {
    return this.authService.logout(user.id, session?.id, allSessions);
  }

  @Mutation(() => Boolean, { description: 'Revoke a specific session' })
  async revokeSession(
    @CurrentUser() user: AuthorizationSubject,
    @Args('sessionId') sessionId: string,
  ): Promise<boolean> {
    await this.sessionService.revokeSession(sessionId, user.id, 'MANUAL_USER_REVOCATION');
    return true;
  }

  @Query(() => UserProfileGql, { description: 'Retrieve the authenticated user profile' })
  async me(@CurrentUser() user: AuthorizationSubject): Promise<UserProfileGql> {
    return this.authService.getUserProfile(user.id);
  }

  @Query(() => [SessionDtoGql], { description: 'List active sessions for current user' })
  async mySessions(
    @CurrentUser() user: AuthorizationSubject,
    @CurrentSession() currentSession: { id: string } | undefined,
  ): Promise<SessionDtoGql[]> {
    const sessions = await this.sessionService.getActiveSessions(user.id);
    return sessions.map((s) => ({
      id: s.id,
      deviceId: s.deviceId || undefined,
      deviceName: s.device?.deviceName || undefined,
      isCurrent: s.id === currentSession?.id,
      ipAddress: s.ipAddress || undefined,
      lastActiveAt: s.lastActiveAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
    }));
  }

  @Query(() => [DeviceDtoGql], { description: 'List registered devices for current user' })
  async myDevices(@CurrentUser() user: AuthorizationSubject): Promise<DeviceDtoGql[]> {
    const devices = await this.sessionService.getUserDevices(user.id);
    return devices.map((d) => ({
      id: d.id,
      deviceId: d.deviceId,
      deviceType: d.deviceType,
      deviceName: d.deviceName,
      platform: d.platform || undefined,
      isTrusted: d.isTrusted,
      lastActiveAt: d.lastActiveAt.toISOString(),
    }));
  }

  @Query(() => [SecurityEventDtoGql], { description: 'View recent security audit events' })
  @RequirePermissions(PermissionAction.SECURITY_VIEW_AUDIT)
  async securityAuditLogs(
    @CurrentUser() user: AuthorizationSubject,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit: number,
  ): Promise<SecurityEventDtoGql[]> {
    const events = await this.securityAudit.getRecentEvents(limit, user.id);
    return events.map((e) => ({
      id: e.id,
      action: e.action,
      result: e.result,
      reason: e.reason || undefined,
      createdAt: e.createdAt.toISOString(),
    }));
  }
}
