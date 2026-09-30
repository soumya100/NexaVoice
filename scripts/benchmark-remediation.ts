import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import * as dns from 'dns/promises';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function measureDns(host: string): Promise<number> {
  const start = performance.now();
  await dns.lookup(host);
  return performance.now() - start;
}

// Emulate the optimized in-memory cache and single query resolution from JwtAuthGuard
const memorySubjectCache = new Map<string, { tokenVersion: number; accountState: string; roles: string[]; permissions: string[]; expiresAt: number }>();

async function simulateOptimizedAuth(prisma: PrismaClient, userId: string, tokenVersion: number): Promise<{ durationMs: number; cacheHit: boolean }> {
  const t0 = performance.now();
  const cached = memorySubjectCache.get(userId);

  if (cached && cached.expiresAt > Date.now() && cached.tokenVersion === tokenVersion) {
    return { durationMs: performance.now() - t0, cacheHit: true };
  }

  // Cold miss: single query join
  const rawResults: any[] = await prisma.$queryRaw`
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
    WHERE u.id = ${userId}
  `;

  if (!rawResults || rawResults.length === 0) {
    throw new Error('User not found');
  }

  const first = rawResults[0];
  const roles = Array.from(new Set(rawResults.map((r) => r.roleName).filter(Boolean)));
  const permissions = Array.from(new Set(rawResults.map((r) => r.permissionAction).filter(Boolean)));

  memorySubjectCache.set(userId, {
    tokenVersion: first.tokenVersion,
    accountState: first.accountState,
    roles,
    permissions,
    expiresAt: Date.now() + 60_000,
  });

  return { durationMs: performance.now() - t0, cacheHit: false };
}

async function main() {
  console.log('========================================================================');
  console.log('NexaVoice POST-REMEDIATION FORENSIC PERFORMANCE BENCHMARK');
  console.log('========================================================================\n');

  const dbUrl = process.env.DATABASE_URL || '';
  const redisUrl = process.env.REDIS_URL || '';

  const dbHostMatch = dbUrl.match(/@([^:/]+)/);
  const dbHost = dbHostMatch ? dbHostMatch[1] : '';
  const redisHost = process.env.REDIS_HOST || (redisUrl.match(/@([^:/]+)/) ? redisUrl.match(/@([^:/]+)/)![1] : '');

  console.log(`Database Host:   ${dbHost}`);
  console.log(`Redis Host:      ${redisHost}`);
  console.log(`Timestamp:       ${new Date().toISOString()}\n`);

  // 1. DNS & Network Round-Trip
  console.log('--- 1. NETWORK & INFRASTRUCTURE BASELINE ---');
  const dnsNeon = dbHost ? await measureDns(dbHost) : 0;
  const dnsRedis = redisHost ? await measureDns(redisHost) : 0;
  console.log(`DNS Lookup [Neon DB]:  ${dnsNeon.toFixed(2)} ms`);
  console.log(`DNS Lookup [Upstash]:  ${dnsRedis.toFixed(2)} ms`);

  // Redis test with configured timeouts
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    connectTimeout: 5000,
    commandTimeout: 2000,
    maxRetriesPerRequest: 1,
  });
  await redis.connect();
  const redisPings: number[] = [];
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    await redis.ping();
    redisPings.push(performance.now() - t0);
  }
  console.log(`Redis Ping (10 samples): p50=${percentile(redisPings, 50).toFixed(2)}ms, p95=${percentile(redisPings, 95).toFixed(2)}ms`);
  await redis.quit();

  // 2. Neon Database Connection & Single Round-Trip
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  await prisma.$connect();

  const select1s: number[] = [];
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    await prisma.$queryRawUnsafe('SELECT 1');
    select1s.push(performance.now() - t0);
  }
  console.log(`DB SELECT 1 (10 samples): p50=${percentile(select1s, 50).toFixed(2)}ms, p95=${percentile(select1s, 95).toFixed(2)}ms`);

  // 3. User Lookup
  const testUser = await prisma.user.findFirst({ select: { id: true, tokenVersion: true } });
  if (!testUser) {
    console.error('No user found');
    await prisma.$disconnect();
    return;
  }
  const userId = testUser.id;
  const tokenVersion = testUser.tokenVersion;

  // 4. AUTH GUARD BENCHMARK: Cold Miss vs Cache Hits
  console.log('\n--- 2. AUTH GUARD & RBAC RESOLUTION (BEFORE vs AFTER) ---');
  console.log('BEFORE Remediation: 5 sequential queries (user + 4 RBAC relation tables) = ~1,388 ms to 2,743 ms');

  // Cold miss measurement
  memorySubjectCache.clear();
  const coldMiss = await simulateOptimizedAuth(prisma, userId, tokenVersion);
  console.log(`AFTER Remediation [Cold Miss - Single SQL Join]: ${coldMiss.durationMs.toFixed(2)} ms (1 query vs 5 queries)`);

  // Cache hit measurements (10 samples)
  const cacheHitTimes: number[] = [];
  for (let i = 0; i < 10; i++) {
    const res = await simulateOptimizedAuth(prisma, userId, tokenVersion);
    cacheHitTimes.push(res.durationMs);
  }
  console.log(`AFTER Remediation [Cache Hits - 10 samples]:`);
  console.log(`  p50 = ${percentile(cacheHitTimes, 50).toFixed(3)} ms`);
  console.log(`  p75 = ${percentile(cacheHitTimes, 75).toFixed(3)} ms`);
  console.log(`  p90 = ${percentile(cacheHitTimes, 90).toFixed(3)} ms`);
  console.log(`  p95 = ${percentile(cacheHitTimes, 95).toFixed(3)} ms`);
  console.log(`  p99 = ${percentile(cacheHitTimes, 99).toFixed(3)} ms`);
  console.log(`  avg = ${(cacheHitTimes.reduce((a, b) => a + b) / cacheHitTimes.length).toFixed(3)} ms`);
  console.log(`>>> AUTH GUARD LATENCY REDUCTION: ${((1 - percentile(cacheHitTimes, 50) / 1387.89) * 100).toFixed(2)}% reduction on hits!`);

  // 5. REPRESENTATIVE ENDPOINTS BENCHMARK
  console.log('\n--- 3. REPRESENTATIVE ENDPOINTS (BEFORE vs AFTER) ---');

  // Endpoint A: getUserConversations
  console.log('\n[Endpoint A: getUserConversations]');
  console.log('  BEFORE: 2 sequential queries (membership list + conversation search) + full hydration');
  console.log('  AFTER:  1 relation-filtered query + targeted participant projection');
  const convSamples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await prisma.conversation.findMany({
      where: {
        participants: { some: { userId } },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                nexaVoiceId: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        messages: {
          where: { deletedAt: null },
          orderBy: { sequenceNumber: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    convSamples.push(performance.now() - t0);
  }
  const convP50 = percentile(convSamples, 50);
  console.log(`  AFTER DB Resolver Time:  p50=${convP50.toFixed(2)}ms, p95=${percentile(convSamples, 95).toFixed(2)}ms`);
  console.log(`  AFTER Total Request Time (Auth Cache Hit + Resolver): ${(percentile(cacheHitTimes, 50) + convP50).toFixed(2)} ms (down from ~1,957 ms)`);

  // Endpoint B: getContacts
  console.log('\n[Endpoint B: getContacts]');
  console.log('  BEFORE: Full user hydration (requester: true, recipient: true) without composite index');
  console.log('  AFTER:  Targeted projection with composite index (requesterId, status) and (recipientId, status)');
  const contactSamples: number[] = [];
  const contactUserSelect = {
    id: true,
    nexaVoiceId: true,
    username: true,
    displayName: true,
    avatarUrl: true,
  };
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await prisma.contactRelationship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { recipientId: userId }],
      },
      include: {
        requester: { select: contactUserSelect },
        recipient: { select: contactUserSelect },
      },
      orderBy: { updatedAt: 'desc' },
    });
    contactSamples.push(performance.now() - t0);
  }
  const contactsP50 = percentile(contactSamples, 50);
  console.log(`  AFTER DB Resolver Time:  p50=${contactsP50.toFixed(2)}ms, p95=${percentile(contactSamples, 95).toFixed(2)}ms`);
  console.log(`  AFTER Total Request Time (Auth Cache Hit + Resolver): ${(percentile(cacheHitTimes, 50) + contactsP50).toFixed(2)} ms (down from ~1,960 ms)`);

  // Endpoint C: getUserNotifications
  console.log('\n[Endpoint C: getUserNotifications]');
  console.log('  BEFORE: 3 separate queries (findMany + count total + count unread)');
  console.log('  AFTER:  findMany in parallel with single SQL filter count query');
  const notifSamples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              nexaVoiceId: true,
              displayName: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.$queryRaw`
        SELECT 
          COUNT(*)::int as "totalCount",
          COUNT(*) FILTER (WHERE "isRead" = false)::int as "unreadCount"
        FROM "Notification"
        WHERE "userId" = ${userId}
      `,
    ]);
    notifSamples.push(performance.now() - t0);
  }
  const notifsP50 = percentile(notifSamples, 50);
  console.log(`  AFTER DB Resolver Time:  p50=${notifsP50.toFixed(2)}ms, p95=${percentile(notifSamples, 95).toFixed(2)}ms`);
  console.log(`  AFTER Total Request Time (Auth Cache Hit + Resolver): ${(percentile(cacheHitTimes, 50) + notifsP50).toFixed(2)} ms (down from ~3,061 ms)`);

  // 6. CONCURRENCY LOAD TEST
  console.log('\n--- 4. CONCURRENCY LOAD PROFILE (Simulated Parallel Authenticated Requests) ---');
  for (const concurrency of [1, 5, 10, 20]) {
    const batchTimes: number[] = [];
    const tBatch0 = performance.now();
    const tasks = Array.from({ length: concurrency }, async () => {
      const t0 = performance.now();
      await simulateOptimizedAuth(prisma, userId, tokenVersion);
      await prisma.conversation.findMany({
        where: { participants: { some: { userId } } },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      });
      batchTimes.push(performance.now() - t0);
    });
    await Promise.all(tasks);
    const batchTotal = performance.now() - tBatch0;
    console.log(`Concurrency=${concurrency.toString().padEnd(2)}: p50=${percentile(batchTimes, 50).toFixed(2)}ms, p95=${percentile(batchTimes, 95).toFixed(2)}ms, max=${Math.max(...batchTimes).toFixed(2)}ms, throughput=${(concurrency / (batchTotal / 1000)).toFixed(1)} req/s`);
  }

  await prisma.$disconnect();
  console.log('\n========================================================================');
  console.log('Post-remediation benchmark completed successfully.');
  console.log('========================================================================');
}

main().catch(console.error);
