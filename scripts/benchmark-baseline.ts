import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import * as dns from 'dns/promises';
import * as net from 'net';
import * as tls from 'tls';
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

async function measureTlsHandshake(host: string, port = 5432): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
      },
      () => {
        const duration = performance.now() - start;
        socket.destroy();
        resolve(duration);
      },
    );
    socket.on('error', (err) => {
      socket.destroy();
      resolve(-1); // e.g. if plain postgres port doesn't do direct TLS without PG SSLRequest
    });
    socket.setTimeout(5000, () => {
      socket.destroy();
      resolve(-1);
    });
  });
}

async function main() {
  console.log('===============================================================');
  console.log('NexaVoice Forensic Performance Diagnostic & Latency Profiler');
  console.log('===============================================================\n');

  const dbUrl = process.env.DATABASE_URL || '';
  const redisUrl = process.env.REDIS_URL || '';

  const dbHostMatch = dbUrl.match(/@([^:/]+)/);
  const dbHost = dbHostMatch ? dbHostMatch[1] : '';

  const redisHost = process.env.REDIS_HOST || (redisUrl.match(/@([^:/]+)/) ? redisUrl.match(/@([^:/]+)/)![1] : '');

  console.log(`Neon DB Host:    ${dbHost}`);
  console.log(`Upstash Host:    ${redisHost}`);
  console.log(`Client Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  console.log(`Local Time:      ${new Date().toISOString()}\n`);

  // 1. Network / DNS Latency
  console.log('--- 1. NETWORK & DNS RESOLUTION ---');
  if (dbHost) {
    const dnsNeon = await measureDns(dbHost);
    console.log(`DNS Lookup [Neon DB]:    ${dnsNeon.toFixed(2)} ms`);
  }
  if (redisHost) {
    const dnsRedis = await measureDns(redisHost);
    console.log(`DNS Lookup [Upstash]:    ${dnsRedis.toFixed(2)} ms`);
  }

  // 2. Redis Latency
  console.log('\n--- 2. UPSTASH REDIS LATENCY PROFILING ---');
  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    const rConnStart = performance.now();
    await redis.connect();
    const rConnTime = performance.now() - rConnStart;
    console.log(`Redis Connect Time:      ${rConnTime.toFixed(2)} ms`);

    const pings: number[] = [];
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      await redis.ping();
      pings.push(performance.now() - t0);
    }
    console.log(`Redis Ping (10 samples): p50=${percentile(pings, 50).toFixed(2)}ms, p95=${percentile(pings, 95).toFixed(2)}ms, min=${Math.min(...pings).toFixed(2)}ms, max=${Math.max(...pings).toFixed(2)}ms, avg=${(pings.reduce((a, b) => a + b) / pings.length).toFixed(2)}ms`);

    const writes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      await redis.set(`bench:test:${i}`, JSON.stringify({ ts: Date.now(), data: 'x'.repeat(256) }), 'EX', 60);
      writes.push(performance.now() - t0);
    }
    console.log(`Redis SET (5 samples):   p50=${percentile(writes, 50).toFixed(2)}ms, p95=${percentile(writes, 95).toFixed(2)}ms`);

    const reads: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      await redis.get(`bench:test:${i}`);
      reads.push(performance.now() - t0);
    }
    console.log(`Redis GET (5 samples):   p50=${percentile(reads, 50).toFixed(2)}ms, p95=${percentile(reads, 95).toFixed(2)}ms`);

    await redis.quit();
  } catch (err: any) {
    console.error(`Redis benchmark error: ${err.message}`);
  }

  // 3. Neon PostgreSQL Latency
  console.log('\n--- 3. NEON POSTGRESQL & PRISMA QUERY PROFILING ---');
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: [],
  });

  try {
    const dbConnStart = performance.now();
    await prisma.$connect();
    const dbConnTime = performance.now() - dbConnStart;
    console.log(`Prisma $connect Time:    ${dbConnTime.toFixed(2)} ms`);

    // Warm-up query
    const tWarm = performance.now();
    await prisma.$queryRawUnsafe('SELECT 1');
    console.log(`First Query (Warm-up):   ${(performance.now() - tWarm).toFixed(2)} ms`);

    // SELECT 1 round-trips
    const select1s: number[] = [];
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      await prisma.$queryRawUnsafe('SELECT 1');
      select1s.push(performance.now() - t0);
    }
    console.log(`SELECT 1 (10 samples):   p50=${percentile(select1s, 50).toFixed(2)}ms, p95=${percentile(select1s, 95).toFixed(2)}ms, min=${Math.min(...select1s).toFixed(2)}ms, max=${Math.max(...select1s).toFixed(2)}ms, avg=${(select1s.reduce((a, b) => a + b) / select1s.length).toFixed(2)}ms`);

    // 4. Trace the exact Auth Guard query path!
    console.log('\n--- 4. AUTH GUARD TRACE & SIMULATION ---');
    // Fetch one test user
    const firstUser = await prisma.user.findFirst({ select: { id: true } });
    if (!firstUser) {
      console.log('No user in database to benchmark auth guard.');
    } else {
      const testUserId = firstUser.id;

      const userLookups: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        await prisma.user.findUnique({
          where: { id: testUserId },
          select: { id: true, accountState: true, tokenVersion: true },
        });
        userLookups.push(performance.now() - t0);
      }
      console.log(`Query 1 [user.findUnique]: p50=${percentile(userLookups, 50).toFixed(2)}ms, avg=${(userLookups.reduce((a, b) => a + b) / userLookups.length).toFixed(2)}ms`);

      const rbacLookups: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        await prisma.userRoleAssignment.findMany({
          where: { userId: testUserId },
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
        rbacLookups.push(performance.now() - t0);
      }
      console.log(`Query 2 [RBAC 3-level tree]: p50=${percentile(rbacLookups, 50).toFixed(2)}ms, avg=${(rbacLookups.reduce((a, b) => a + b) / rbacLookups.length).toFixed(2)}ms`);

      const totalAuthOverhead = percentile(userLookups, 50) + percentile(rbacLookups, 50);
      console.log(`>>> TOTAL AUTH GUARD OVERHEAD PER REQUEST: ${totalAuthOverhead.toFixed(2)} ms (BEFORE any resolver runs!)`);

      // 5. Trace Representative Endpoints
      console.log('\n--- 5. REPRESENTATIVE ENDPOINT TRACES (Sequential DB Queries) ---');

      // Endpoint A: getConversations
      const tConv0 = performance.now();
      const participants = await prisma.conversationParticipant.findMany({
        where: { userId: testUserId },
        include: {
          conversation: {
            include: {
              participants: {
                include: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      const convTime = performance.now() - tConv0;
      console.log(`Endpoint A [getConversations resolver]: ${convTime.toFixed(2)} ms`);
      console.log(`  Combined Request Time (Auth + Resolver): ${(totalAuthOverhead + convTime).toFixed(2)} ms`);

      // Endpoint B: getContacts
      const tContacts0 = performance.now();
      const contacts = await prisma.contactRelationship.findMany({
        where: {
          OR: [{ requesterId: testUserId }, { recipientId: testUserId }],
          status: 'ACCEPTED',
        },
        include: {
          requester: {
            select: { id: true, nexaVoiceId: true, username: true, displayName: true },
          },
          recipient: {
            select: { id: true, nexaVoiceId: true, username: true, displayName: true },
          },
        },
      });
      const contactsTime = performance.now() - tContacts0;
      console.log(`Endpoint B [getContacts resolver]: ${contactsTime.toFixed(2)} ms`);
      console.log(`  Combined Request Time (Auth + Resolver): ${(totalAuthOverhead + contactsTime).toFixed(2)} ms`);

      // Endpoint C: getNotifications (3 sequential queries!)
      const tNotif0 = performance.now();
      const notifs = await prisma.notification.findMany({
        where: { userId: testUserId },
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      const notifTime1 = performance.now() - tNotif0;

      const tNotifCount1 = performance.now();
      const totalCount = await prisma.notification.count({ where: { userId: testUserId } });
      const notifTime2 = performance.now() - tNotifCount1;

      const tNotifCount2 = performance.now();
      const unreadCount = await prisma.notification.count({ where: { userId: testUserId, isRead: false } });
      const notifTime3 = performance.now() - tNotifCount2;

      const totalNotifTime = notifTime1 + notifTime2 + notifTime3;
      console.log(`Endpoint C [getNotifications: findMany (${notifTime1.toFixed(1)}ms) + count1 (${notifTime2.toFixed(1)}ms) + count2 (${notifTime3.toFixed(1)}ms)]: Total ${totalNotifTime.toFixed(2)} ms`);
      console.log(`  Combined Request Time (Auth + Resolver): ${(totalAuthOverhead + totalNotifTime).toFixed(2)} ms`);
    }

    await prisma.$disconnect();
  } catch (err: any) {
    console.error(`Prisma benchmark error: ${err.message}`);
  }

  console.log('\n===============================================================');
  console.log('Diagnostic execution completed.');
  console.log('===============================================================');
}

main().catch(console.error);
