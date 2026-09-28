import {
  BadRequestException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  AccountState,
  AuthTokenPayload,
  SystemRole,
  UserStatus,
} from '@nexavoice/domain-types';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { PasswordHasher } from '../../common/security/password-hasher';
import { IdGenerator } from '../../common/security/id-generator';
import { SessionService } from './session.service';
import { RbacService } from '../authorization/rbac.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { EmailService } from '../email/email.service';
import {
  AuthPayloadGql,
  LoginInput,
  PasswordResetResponseGql,
  RegisterInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  UserProfileGql,
} from './authentication.types';

@Injectable()
export class AuthenticationService {
  private readonly accessExpirationSeconds: number;
  private readonly inMemoryResetTokens = new Map<string, { userId: string; email: string; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly rbacService: RbacService,
    private readonly securityAudit: SecurityAuditService,
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly emailService?: EmailService,
  ) {
    this.accessExpirationSeconds = this.configService.get<number>(
      'jwt.accessExpiration',
      900, // 15 minutes default
    );
  }

  /**
   * Registers a new user, hashes password securely, initializes default roles and AI profile, and issues tokens.
   */
  async register(
    input: RegisterInput,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthPayloadGql> {
    if (!this.prisma.isDatabaseConnected()) {
      throw new BadRequestException('Database is currently offline. Please try again.');
    }

    const cleanUsername = input.username.trim();
    const cleanDisplayName = input.displayName.trim();
    const cleanEmail = input.email ? input.email.trim().toLowerCase() : undefined;
    const cleanPhone = input.phone ? input.phone.trim() : undefined;

    // 1. Check existing username and email
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: cleanUsername, mode: 'insensitive' as const } },
          ...(cleanEmail ? [{ email: { equals: cleanEmail, mode: 'insensitive' as const } }] : []),
        ],
      },
    });

    if (existing) {
      if (existing.username.toLowerCase() === cleanUsername.toLowerCase()) {
        throw new BadRequestException('Username is already taken');
      }
      throw new BadRequestException('Email is already registered');
    }

    // 2. Hash password & generate canonical NexaVoice ID
    const passwordHash = await PasswordHasher.hash(input.password);
    const nexaVoiceId = IdGenerator.generateNexaVoiceId();

    // 3. Create User in PostgreSQL
    const user = await this.prisma.user.create({
      data: {
        nexaVoiceId,
        username: cleanUsername,
        displayName: cleanDisplayName,
        email: cleanEmail,
        phone: cleanPhone,
        passwordHash,
        status: UserStatus.ONLINE,
        accountState: AccountState.ACTIVE,
        aiProfile: {
          create: {
            name: `${cleanDisplayName}'s AI`,
            personality: 'Helpful, Concise, Professional',
            language: 'en-US',
          },
        },
      },
    });

    // 4. Assign default USER role
    await this.rbacService.assignRoleToUser(user.id, SystemRole.USER);

    // 5. Register Device if provided
    let registeredDeviceId: string | undefined;
    if (input.device) {
      const dev = await this.sessionService.registerOrUpdateDevice(user.id, {
        deviceId: input.device.deviceId,
        deviceType: input.device.deviceType,
        deviceName: input.device.deviceName,
        platform: input.device.platform,
        appVersion: input.device.appVersion,
      });
      registeredDeviceId = dev.id;
    }

    // 6. Create initial Session and rotating refresh token
    const session = await this.sessionService.createSession({
      userId: user.id,
      deviceId: registeredDeviceId,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    // 7. Generate short-lived JWT Access Token
    const userPerms = await this.rbacService.getUserPermissions(user.id);
    const accessToken = await this.generateAccessToken({
      sub: user.id,
      nexaVoiceId: user.nexaVoiceId,
      sid: session.sessionId,
      tokenVersion: user.tokenVersion,
      roles: userPerms.roles,
    });

    await this.securityAudit.logEvent({
      actorId: user.id,
      action: 'USER_REGISTERED',
      targetType: 'User',
      targetId: user.id,
      result: 'SUCCESS',
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    const userProfile = await this.getUserProfile(user.id);

    return {
      accessToken,
      refreshToken: session.rawRefreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessExpirationSeconds,
      user: userProfile,
    };
  }

  /**
   * Authenticates user credentials with brute-force throttling and lockout detection.
   */
  async login(
    input: LoginInput,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthPayloadGql> {
    if (!this.prisma.isDatabaseConnected()) {
      throw new BadRequestException('Database is currently offline. Please try again.');
    }

    const cleanIdentifier = input.identifier.trim();

    // 1. Locate user by username, email, or NexaVoice ID
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: cleanIdentifier, mode: 'insensitive' as const } },
          { email: { equals: cleanIdentifier, mode: 'insensitive' as const } },
          { nexaVoiceId: { equals: cleanIdentifier, mode: 'insensitive' as const } },
        ],
      },
    });

    // 1b. Fallback: If not matched by username/email/ID, check displayName or phone
    if (!user) {
      user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { displayName: { equals: cleanIdentifier, mode: 'insensitive' as const } },
            ...(cleanIdentifier.startsWith('+') || /^\d+$/.test(cleanIdentifier)
              ? [{ phone: { equals: cleanIdentifier, mode: 'insensitive' as const } }]
              : []),
          ],
        },
      });
    }

    if (!user) {
      await this.securityAudit.logEvent({
        action: 'LOGIN_FAILURE_UNKNOWN_USER',
        result: 'FAILURE',
        reason: 'User not found',
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: { identifierAttempt: cleanIdentifier },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. Check Lockout Status
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      await this.securityAudit.logEvent({
        actorId: user.id,
        action: 'LOGIN_REJECTED_LOCKED_OUT',
        result: 'DENIED',
        reason: 'Account is temporarily locked out due to multiple failed attempts',
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      });
      throw new UnauthorizedException('Account is temporarily locked due to failed login attempts. Please try again later.');
    }

    // 3. Check Account State (Reject SUSPENDED, LOCKED, DEACTIVATED, DELETED)
    if (user.accountState !== AccountState.ACTIVE) {
      await this.securityAudit.logEvent({
        actorId: user.id,
        action: 'LOGIN_REJECTED_ACCOUNT_STATE',
        result: 'DENIED',
        reason: `Account state is ${user.accountState}`,
        ipAddress: metadata?.ipAddress,
      });
      throw new UnauthorizedException(`Account is ${user.accountState}; access denied.`);
    }

    // 4. Verify Password
    const isValid = await PasswordHasher.verify(input.password, user.passwordHash);
    if (!isValid) {
      const attempts = user.failedLoginAttempts + 1;
      const willLockout = attempts >= 5;
      const lockoutUntil = willLockout ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockoutUntil,
        },
      });

      await this.securityAudit.logEvent({
        actorId: user.id,
        action: willLockout ? 'LOGIN_FAILURE_LOCKOUT_TRIGGERED' : 'LOGIN_FAILURE_BAD_PASSWORD',
        result: 'FAILURE',
        reason: 'Invalid password',
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // 5. Reset failed login attempts on success
    if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockoutUntil: null,
          status: UserStatus.ONLINE,
        },
      });
    }

    // 6. Register Device if provided
    let registeredDeviceId: string | undefined;
    if (input.device) {
      const dev = await this.sessionService.registerOrUpdateDevice(user.id, {
        deviceId: input.device.deviceId,
        deviceType: input.device.deviceType,
        deviceName: input.device.deviceName,
        platform: input.device.platform,
        appVersion: input.device.appVersion,
      });
      registeredDeviceId = dev.id;
    }

    // 7. Create Session
    const session = await this.sessionService.createSession({
      userId: user.id,
      deviceId: registeredDeviceId,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    // 8. Generate JWT Access Token
    const userPerms = await this.rbacService.getUserPermissions(user.id);
    const accessToken = await this.generateAccessToken({
      sub: user.id,
      nexaVoiceId: user.nexaVoiceId,
      sid: session.sessionId,
      tokenVersion: user.tokenVersion,
      roles: userPerms.roles,
    });

    await this.securityAudit.logEvent({
      actorId: user.id,
      action: 'LOGIN_SUCCESS',
      targetType: 'Session',
      targetId: session.sessionId,
      result: 'SUCCESS',
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    const userProfile = await this.getUserProfile(user.id);

    return {
      accessToken,
      refreshToken: session.rawRefreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessExpirationSeconds,
      user: userProfile,
    };
  }

  /**
   * Refreshes access token and rotates refresh token.
   */
  async refreshToken(
    rawRefreshToken: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthPayloadGql> {
    const rotated = await this.sessionService.rotateRefreshToken(rawRefreshToken, metadata);

    const user = await this.prisma.user.findUnique({
      where: { id: rotated.userId },
    });

    if (!user) {
      throw new UnauthorizedException('User account not found');
    }

    const userPerms = await this.rbacService.getUserPermissions(user.id);
    const accessToken = await this.generateAccessToken({
      sub: user.id,
      nexaVoiceId: user.nexaVoiceId,
      sid: rotated.sessionId,
      tokenVersion: user.tokenVersion,
      roles: userPerms.roles,
    });

    const userProfile = await this.getUserProfile(user.id);

    return {
      accessToken,
      refreshToken: rotated.rawRefreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessExpirationSeconds,
      user: userProfile,
    };
  }

  /**
   * Logs out user by revoking current session or all active sessions.
   */
  async logout(userId: string, sessionId?: string, allSessions = false): Promise<boolean> {
    if (allSessions) {
      await this.sessionService.revokeAllSessions(userId, 'USER_REQUESTED_LOGOUT_ALL');
    } else if (sessionId) {
      await this.sessionService.revokeSession(sessionId, userId, 'USER_LOGOUT');
    }
    return true;
  }

  /**
   * Fetches full user profile including roles and permissions.
   */
  async getUserProfile(userId: string): Promise<UserProfileGql> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const perms = await this.rbacService.getUserPermissions(userId);

    return {
      id: user.id,
      nexaVoiceId: user.nexaVoiceId,
      username: user.username,
      displayName: user.displayName,
      email: user.email || undefined,
      phone: user.phone || undefined,
      avatarUrl: user.avatarUrl || undefined,
      status: user.status,
      accountState: user.accountState,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      roles: perms.roles,
      permissions: perms.permissions,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * Generates a single-use password reset token with 1-hour expiration and logs security event.
   */
  async requestPasswordReset(
    input: RequestPasswordResetInput,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<PasswordResetResponseGql> {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' as const } },
    });

    if (!user) {
      // Mitigate user enumeration attacks: return generic success
      return {
        success: true,
        message: 'If an account exists with this email address, password reset instructions have been sent.',
      };
    }

    const resetToken = randomUUID();
    const ttlSeconds = 3600; // 1 hour
    const tokenData = JSON.stringify({ userId: user.id, email: user.email });

    if (this.redisService?.isRedisConnected()) {
      await this.redisService.set(`pwd_reset:${resetToken}`, tokenData, ttlSeconds);
    } else {
      this.inMemoryResetTokens.set(resetToken, {
        userId: user.id,
        email: user.email || email,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    }

    await this.securityAudit.logEvent({
      actorId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      targetType: 'User',
      targetId: user.id,
      result: 'SUCCESS',
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    if (this.emailService && user.email) {
      await this.emailService
        .sendPasswordResetEmail({
          to: user.email,
          displayName: user.displayName,
          resetToken,
          ipAddress: metadata?.ipAddress,
        })
        .catch(() => {
          // Gracefully suppress external provider errors from breaking client response
        });
    }

    return {
      success: true,
      message: 'If an account exists with this email address, password reset instructions have been sent.',
      resetToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined,
    };
  }

  /**
   * Resets password given a valid token, updates hash, increments tokenVersion, and revokes active sessions.
   */
  async resetPassword(
    input: ResetPasswordInput,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<PasswordResetResponseGql> {
    const { token, newPassword } = input;
    if (!token || !newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    let tokenPayload: { userId: string; email: string } | null = null;

    if (this.redisService?.isRedisConnected()) {
      const data = await this.redisService.get(`pwd_reset:${token}`);
      if (data) {
        tokenPayload = JSON.parse(data);
      }
    } else {
      const entry = this.inMemoryResetTokens.get(token);
      if (entry && entry.expiresAt > Date.now()) {
        tokenPayload = { userId: entry.userId, email: entry.email };
      }
    }

    if (!tokenPayload) {
      await this.securityAudit.logEvent({
        action: 'PASSWORD_RESET_FAILED',
        result: 'FAILURE',
        reason: 'Invalid or expired password reset token',
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      });
      throw new BadRequestException('Invalid or expired password reset token. Please request a new link.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: tokenPayload.userId },
    });

    if (!user) {
      throw new BadRequestException('User account not found');
    }

    // Hash new password
    const passwordHash = await PasswordHasher.hash(newPassword);

    // Update password, increment tokenVersion (invalidates all outstanding JWTs), reset lockout & failed attempts
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

    // Revoke all existing sessions across all devices
    await this.sessionService.revokeAllSessions(user.id, 'USER_PASSWORD_RESET');

    // Clean up used token
    if (this.redisService?.isRedisConnected()) {
      await this.redisService.del(`pwd_reset:${token}`);
    } else {
      this.inMemoryResetTokens.delete(token);
    }

    await this.securityAudit.logEvent({
      actorId: user.id,
      action: 'PASSWORD_RESET_SUCCESS',
      targetType: 'User',
      targetId: user.id,
      result: 'SUCCESS',
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.',
    };
  }

  private async generateAccessToken(payload: AuthTokenPayload): Promise<string> {
    const secret = this.configService.get<string>(
      'jwt.secret',
      'dev-secret-key-32-chars-long-minimum!',
    );
    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn: `${this.accessExpirationSeconds}s`,
    });
  }
}
