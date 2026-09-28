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
   * Also initializes a RefreshTokenFamily and the root RefreshToken in the lineage.
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
        tokenFamilies: {
          create: {
            tokens: {
              create: {
                tokenHash,
                expiresAt,
              },
            },
          },
        },
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
   * Rotates a refresh token with complete multi-hop token lineage reuse detection.
   * If any previously used token in the family tree is presented again,
   * the entire token family AND associated session are immediately revoked.
   */
  async rotateRefreshToken(
    rawRefreshToken: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<RotatedSessionResult> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const presentedHash = TokenGenerator.hashToken(rawRefreshToken);

    // 1. Look up token in RefreshToken table
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: presentedHash },
      include: {
        family: {
          include: {
            session: true,
          },
        },
      },
    });

    if (storedToken) {
      const family = storedToken.family;
      const session =
        family?.session ||
        (family?.sessionId
          ? await this.prisma.session.findUnique({ where: { id: family.sessionId } })
          : null);

      // MULTI-HOP REUSE DETECTION:
      // If the token was ALREADY USED (usedAt !== null or replacedByTokenId !== null) or marked isRevoked
      if (storedToken.usedAt !== null || storedToken.replacedByTokenId !== null || storedToken.isRevoked) {
        // Multi-hop token reuse detected! Immediately revoke entire family and session.
        const ops: any[] = [
          this.prisma.refreshTokenFamily.update({
            where: { id: family.id },
            data: {
              isRevoked: true,
              revokedAt: new Date(),
              revocationReason: 'REFRESH_TOKEN_REUSE_DETECTED',
            },
          }),
          this.prisma.refreshToken.updateMany({
            where: { familyId: family.id },
            data: {
              isRevoked: true,
              revokedAt: new Date(),
            },
          }),
        ];

        if (session) {
          ops.push(
            this.prisma.session.update({
              where: { id: session.id },
              data: {
                isRevoked: true,
                revocationReason: 'REFRESH_TOKEN_REUSE_DETECTED',
              },
            }),
          );
        }

        await this.prisma.$transaction(ops);

        await this.securityAudit.logEvent({
          actorId: session?.userId,
          action: 'REFRESH_TOKEN_REUSE_DETECTED',
          targetType: 'Session',
          targetId: session?.id || family.sessionId,
          result: 'DENIED',
          reason: 'Multi-hop token reuse detected; entire token family and session revoked',
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
        });

        throw new UnauthorizedException('Security incident: refresh token reuse detected. Session revoked.');
      }

      // Check if family or session was already revoked
      if (family.isRevoked || session.isRevoked) {
        throw new UnauthorizedException('Session or token family has been revoked');
      }

      // Check expiration
      if (storedToken.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token has expired');
      }

      // Token is valid and unused -> Rotate
      const newRawRefreshToken = TokenGenerator.generateSecureToken(32);
      const newTokenHash = TokenGenerator.hashToken(newRawRefreshToken);
      const newExpiresAt = new Date(Date.now() + this.refreshExpirationSeconds * 1000);

      await this.prisma.$transaction(async (tx) => {
        const nextToken = await tx.refreshToken.create({
          data: {
            familyId: family.id,
            tokenHash: newTokenHash,
            expiresAt: newExpiresAt,
          },
        });

        await tx.refreshToken.update({
          where: { id: storedToken.id },
          data: {
            usedAt: new Date(),
            replacedByTokenId: nextToken.id,
          },
        });

        await tx.session.update({
          where: { id: session.id },
          data: {
            tokenHash: newTokenHash,
            replacedByTokenHash: presentedHash,
            expiresAt: newExpiresAt,
            lastActiveAt: new Date(),
            ipAddress: metadata?.ipAddress || session.ipAddress,
            userAgent: metadata?.userAgent || session.userAgent,
          },
        });
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

    // 2. Fallback for backwards compatibility with legacy session records
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: presentedHash },
    });

    if (!session || session.isRevoked) {
      const legacyCompromised = await this.prisma.session.findFirst({
        where: { replacedByTokenHash: presentedHash },
      });
      if (legacyCompromised) {
        await this.prisma.session.update({
          where: { id: legacyCompromised.id },
          data: { isRevoked: true, revocationReason: 'REFRESH_TOKEN_REUSE_DETECTED' },
        });
        await this.securityAudit.logEvent({
          actorId: legacyCompromised.userId,
          action: 'REFRESH_TOKEN_REUSE_DETECTED',
          targetType: 'Session',
          targetId: legacyCompromised.id,
          result: 'DENIED',
          reason: 'Token reuse detected; session terminated immediately',
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
        });
      }
      throw new UnauthorizedException('Invalid or revoked session');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Upgrade session to token family
    const newRawRefreshToken = TokenGenerator.generateSecureToken(32);
    const newTokenHash = TokenGenerator.hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + this.refreshExpirationSeconds * 1000);

    await this.prisma.$transaction(async (tx) => {
      const family = await tx.refreshTokenFamily.create({
        data: {
          sessionId: session.id,
        },
      });

      const oldToken = await tx.refreshToken.create({
        data: {
          familyId: family.id,
          tokenHash: presentedHash,
          expiresAt: session.expiresAt,
          usedAt: new Date(),
        },
      });

      const nextToken = await tx.refreshToken.create({
        data: {
          familyId: family.id,
          tokenHash: newTokenHash,
          expiresAt: newExpiresAt,
        },
      });

      await tx.refreshToken.update({
        where: { id: oldToken.id },
        data: { replacedByTokenId: nextToken.id },
      });

      await tx.session.update({
        where: { id: session.id },
        data: {
          tokenHash: newTokenHash,
          replacedByTokenHash: presentedHash,
          expiresAt: newExpiresAt,
          lastActiveAt: new Date(),
          ipAddress: metadata?.ipAddress || session.ipAddress,
          userAgent: metadata?.userAgent || session.userAgent,
        },
      });
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
   * Revokes a specific session and its associated token families.
   */
  async revokeSession(sessionId: string, userId: string, reason = 'USER_LOGOUT'): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Cannot revoke session: session not found or unauthorized');
    }

    await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: sessionId },
        data: {
          isRevoked: true,
          revocationReason: reason,
        },
      }),
      this.prisma.refreshTokenFamily.updateMany({
        where: { sessionId },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
          revocationReason: reason,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { family: { sessionId } },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      }),
    ]);

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
    const userSessions = await this.prisma.session.findMany({
      where: { userId, isRevoked: false },
      select: { id: true },
    });

    const sessionIds = userSessions.map((s) => s.id);

    await this.prisma.$transaction([
      this.prisma.session.updateMany({
        where: { userId, isRevoked: false },
        data: {
          isRevoked: true,
          revocationReason: reason,
        },
      }),
      this.prisma.refreshTokenFamily.updateMany({
        where: { sessionId: { in: sessionIds } },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
          revocationReason: reason,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { family: { sessionId: { in: sessionIds } } },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          tokenVersion: { increment: 1 },
        },
      }),
    ]);

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
