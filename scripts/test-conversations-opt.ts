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

  // 1. Current 2-query waterfall with full user hydration
  const t0 = performance.now();
  const userMemberships = await prisma.conversationParticipant.findMany({
    where: { userId: user.id },
    select: { conversationId: true },
  });
  const conversationIds = userMemberships.map((m) => m.conversationId);
  const convs1 = await prisma.conversation.findMany({
    where: { id: { in: conversationIds } },
    include: {
      participants: {
        include: { user: true },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { sequenceNumber: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
  const tBefore = performance.now() - t0;
  console.log(`Current getUserConversations (2 queries + full hydration): ${tBefore.toFixed(2)} ms; count: ${convs1.length}`);

  // 2. Optimized 1-query with relation filter and targeted projection
  const t1 = performance.now();
  const convs2 = await prisma.conversation.findMany({
    where: {
      participants: {
        some: { userId: user.id },
      },
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
  const tAfter = performance.now() - t1;
  console.log(`Optimized getUserConversations (1 query + targeted projection): ${tAfter.toFixed(2)} ms; count: ${convs2.length}`);
  console.log(`Savings: ${(tBefore - tAfter).toFixed(2)} ms (${((1 - tAfter / tBefore) * 100).toFixed(1)}% reduction)!`);

  await prisma.$disconnect();
}

main().catch(console.error);
