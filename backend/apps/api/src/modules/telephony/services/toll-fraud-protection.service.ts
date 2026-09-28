import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { NormalizedPhoneNumber } from './phone-number-normalizer.service';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

export interface FraudPolicyConfig {
  maxCallsPerMinute: number;
  maxConcurrentCalls: number;
  allowedCountryCodes: string[];
  blockHighRiskPremium: boolean;
}

@Injectable()
export class TollFraudProtectionService {
  private readonly logger = new StructuredLogger('TollFraudProtectionService');
  private userCallTimestamps = new Map<string, number[]>();

  private defaultPolicy: FraudPolicyConfig = {
    maxCallsPerMinute: 10,
    maxConcurrentCalls: 1,
    allowedCountryCodes: ['US', 'CA', 'GB', 'IN', 'AU', 'DE', 'FR'],
    blockHighRiskPremium: true,
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates toll fraud rules before an outbound PSTN call is created.
   * Throws ForbiddenException if blocked by fraud policy.
   */
  async assertCanInitiateCall(userId: string, targetNumber: NormalizedPhoneNumber): Promise<void> {
    // 1. Block high-risk / premium destinations (900 numbers, satellite +870/+881)
    if (this.defaultPolicy.blockHighRiskPremium && targetNumber.isHighRiskPremium) {
      this.logger.warn({
        event: 'toll_fraud_blocked_premium_destination',
        userId,
        targetNumber: targetNumber.e164,
      });
      throw new ForbiddenException(
        `Calls to premium-rate or high-risk destinations (${targetNumber.e164}) are prohibited.`,
      );
    }

    // 2. Validate destination country policy
    if (
      targetNumber.countryCode !== 'UNKNOWN' &&
      !this.defaultPolicy.allowedCountryCodes.includes(targetNumber.countryCode)
    ) {
      this.logger.warn({
        event: 'toll_fraud_blocked_unauthorized_country',
        userId,
        countryCode: targetNumber.countryCode,
        targetNumber: targetNumber.e164,
      });
      throw new ForbiddenException(
        `Outbound calls to country '${targetNumber.countryCode}' are disabled by organization policy.`,
      );
    }

    // 3. Rate limiting: calls per minute window
    const now = Date.now();
    const timestamps = this.userCallTimestamps.get(userId) || [];
    const oneMinuteAgo = now - 60_000;
    const recentCalls = timestamps.filter((t) => t > oneMinuteAgo);

    if (recentCalls.length >= this.defaultPolicy.maxCallsPerMinute) {
      this.logger.warn({
        event: 'toll_fraud_rate_limit_exceeded',
        userId,
        recentCallCount: recentCalls.length,
      });
      throw new ForbiddenException(
        'Call rate limit exceeded. Please wait before initiating another outbound call.',
      );
    }

    recentCalls.push(now);
    this.userCallTimestamps.set(userId, recentCalls);

    // 4. Concurrency check: enforce max concurrent active PSTN legs per user
    const activePstnLegs = await this.prisma.callLeg.count({
      where: {
        userId,
        status: { in: ['RINGING', 'CONNECTING', 'CONNECTED'] },
        callSession: {
          callType: 'PSTN',
        },
      },
    });

    if (activePstnLegs >= this.defaultPolicy.maxConcurrentCalls) {
      this.logger.warn({
        event: 'toll_fraud_concurrent_call_limit_exceeded',
        userId,
        activePstnLegs,
      });
      throw new ForbiddenException(
        'You already have an active PSTN call. Concurrent outbound PSTN calls are limited.',
      );
    }
  }

  setPolicy(policy: Partial<FraudPolicyConfig>) {
    this.defaultPolicy = { ...this.defaultPolicy, ...policy };
  }

  resetRateLimits(): void {
    this.userCallTimestamps.clear();
  }
}
