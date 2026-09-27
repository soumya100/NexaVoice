import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TokenGenerator } from '../../common/security/token-generator';
import { SecurityAuditService } from '../security/security-audit.service';

export interface CreateSessionOptions {
  userId: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RotatedSessionResult {
  sessionId: string;
  userId: string;
  rawRefreshToken: string;
}

@Injectable()
export class SessionService {
  private readonly refreshExpirationSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly securityAudit: SecurityAuditService,
  ) {
    this.refreshExpirationSeconds = this.configService.get<number>(
      'jwt.refreshExpiration',
      604800, // 7 days default
    );
  }

  /**
   * Creates a new authenticated session for a user and device.
   * Generates a high-entropy refresh token, persisting only its SHA-256 hash.
   */
  async createSession(options: CreateSessionOptions): Promise<{
    sessionId: string;
    rawRefreshToken: string;
    expiresAt: Date;
  }> {
    const rawRefreshToken = TokenGenerator.generateSecureToken(32);
    const tokenHash = TokenGenerator.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + this.refreshExpirationSeconds * 1000);

    const session = await this.prisma.session.create({
      data: {
        userId: options.userId,
        deviceId: options.deviceId,
        tokenHash,
        expiresAt,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      },
    });

    await this.securityAudit.logEvent({
      actorId: options.userId,
      action: 'SESSION_CREATED',
      targetType: 'Session',
      targetId: session.id,
      result: 'SUCCESS',
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    });

    return {
      sessionId: session.id,
      rawRefreshToken,
      expiresAt,
    };
  }

  /**
   * Rotates a refresh token with automatic reuse detection.
   * If a replaced token hash is presented again, all associated tokens are revoked and a security incident is logged.
   */
  async rotateRefreshToken(
    rawRefreshToken: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<RotatedSessionResult> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const presentedHash = TokenGenerator.hashToken(rawRefreshToken);

    // 1. Check if token matches a previously replaced token (Token Theft / Reuse Attack)
    const compromisedSession = await this.prisma.session.findFirst({
      where: { replacedByTokenHash: presentedHash },
    });

    if (compromisedSession) {
      // Immediate revocation of the entire session due to reuse detection
      await this.prisma.session.update({
        where: { id: compromisedSession.id },
        data: {
          isRevoked: true,
          revocationReason: 'REFRESH_TOKEN_REUSE_DETECTED',
        },
      });

      await this.securityAudit.logEvent({
        actorId: compromisedSession.userId,
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        targetType: 'Session',
        targetId: compromisedSession.id,
        result: 'DENIED',
        reason: 'Token reuse detected; session terminated immediately',
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      });

      throw new UnauthorizedException('Security incident: refresh token reuse detected. Session revoked.');
    }

    // 2. Look up session by active token hash
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: presentedHash },
      include: { user: true },
    });

    if (!session || session.isRevoked) {
      throw new UnauthorizedException('Invalid or revoked session');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // 3. Rotate: Issue new high-entropy token and update session
    const newRawRefreshToken = TokenGenerator.generateSecureToken(32);
    const newTokenHash = TokenGenerator.hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + this.refreshExpirationSeconds * 1000);

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        tokenHash: newTokenHash,
        replacedByTokenHash: presentedHash, // Keep historical trail for reuse detection
        expiresAt: newExpiresAt,
        lastActiveAt: new Date(),
        ipAddress: metadata?.ipAddress || session.ipAddress,
        userAgent: metadata?.userAgent || session.userAgent,
      },
    });

    await this.securityAudit.logEvent({
      actorId: session.userId,
      action: 'TOKEN_REFRESHED',
      targetType: 'Session',
      targetId: session.id,
      result: 'SUCCESS',
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      sessionId: session.id,
      userId: session.userId,
      rawRefreshToken: newRawRefreshToken,
    };
  }

  /**
   * Revokes a specific session.
   */
  async revokeSession(sessionId: string, userId: string, reason = 'USER_LOGOUT'): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Cannot revoke session: session not found or unauthorized');
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        isRevoked: true,
        revocationReason: reason,
      },
    });

    await this.securityAudit.logEvent({
      actorId: userId,
      action: 'SESSION_REVOKED',
      targetType: 'Session',
      targetId: sessionId,
      result: 'SUCCESS',
      reason,
    });
  }

  /**
   * Revokes all active sessions for a user (e.g. password reset or global logout).
   */
  async revokeAllSessions(userId: string, reason = 'LOGOUT_ALL_SESSIONS'): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: {
        isRevoked: true,
        revocationReason: reason,
      },
    });

    // Increment user tokenVersion to immediately invalidate all stateless access tokens
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        tokenVersion: { increment: 1 },
      },
    });

    await this.securityAudit.logEvent({
      actorId: userId,
      action: 'ALL_SESSIONS_REVOKED',
      targetType: 'User',
      targetId: userId,
      result: 'SUCCESS',
      reason,
    });
  }

  /**
   * Lists active sessions for a user.
   */
  async getActiveSessions(userId: string) {
    return this.prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'desc' },
      include: { device: true },
    });
  }

  /**
   * Registers or updates a device record.
   */
  async registerOrUpdateDevice(userId: string, data: {
    deviceId: string;
    deviceType: string;
    deviceName: string;
    platform?: string;
    appVersion?: string;
    pushToken?: string;
  }) {
    return this.prisma.device.upsert({
      where: { deviceId: data.deviceId },
      create: {
        userId,
        deviceId: data.deviceId,
        deviceType: data.deviceType,
        deviceName: data.deviceName,
        platform: data.platform,
        appVersion: data.appVersion,
        pushToken: data.pushToken,
        lastActiveAt: new Date(),
      },
      update: {
        deviceName: data.deviceName,
        platform: data.platform,
        appVersion: data.appVersion,
        pushToken: data.pushToken,
        lastActiveAt: new Date(),
      },
    });
  }

  /**
   * Lists devices registered to a user.
   */
  async getUserDevices(userId: string) {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
    });
  }
}
