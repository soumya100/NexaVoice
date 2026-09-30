import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) {
    console.log('No user found');
    return;
  }

  // 1. Current approach (3 separate queries)
  const t0 = performance.now();
  const [items1, countTotal1, countUnread1] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      take: 20,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where: { userId: user.id } }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);
  const tBefore = performance.now() - t0;
  console.log(`Current getNotifications (findMany + 2 counts): ${tBefore.toFixed(2)} ms`);

  // 2. Combined count query (findMany + single combined count)
  const t1 = performance.now();
  const [items2, counts] = (await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      take: 20,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.$queryRaw<Array<{ totalCount: number; unreadCount: number }>>`
      SELECT 
        COUNT(*)::int as "totalCount",
        COUNT(*) FILTER (WHERE "isRead" = false)::int as "unreadCount"
      FROM "Notification"
      WHERE "userId" = ${user.id}
    `,
  ])) as [any[], Array<{ totalCount: number; unreadCount: number }>];
  const tAfter = performance.now() - t1;
  const countRow = counts[0] || { totalCount: 0, unreadCount: 0 };
  console.log(`Optimized getNotifications (findMany + 1 combined count query): ${tAfter.toFixed(2)} ms (counts: total=${countRow.totalCount}, unread=${countRow.unreadCount})`);
  console.log(`Savings: ${(tBefore - tAfter).toFixed(2)} ms (${((1 - tAfter / tBefore) * 100).toFixed(1)}% reduction)!`);

  await prisma.$disconnect();
}

main().catch(console.error);
