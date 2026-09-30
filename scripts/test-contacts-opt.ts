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

  // 1. Current getContacts (full hydration of both requester and recipient)
  const t0 = performance.now();
  const rels1 = await prisma.contactRelationship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: user.id }, { recipientId: user.id }],
    },
    include: {
      requester: true,
      recipient: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
  const tBefore = performance.now() - t0;
  console.log(`Current getContacts (full hydration): ${tBefore.toFixed(2)} ms; count: ${rels1.length}`);

  // 2. Targeted projection (only necessary client fields)
  const userSelect = {
    id: true,
    nexaVoiceId: true,
    username: true,
    displayName: true,
    avatarUrl: true,
  };
  const t1 = performance.now();
  const rels2 = await prisma.contactRelationship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: user.id }, { recipientId: user.id }],
    },
    select: {
      id: true,
      requesterId: true,
      recipientId: true,
      status: true,
      nickname: true,
      createdAt: true,
      acceptedAt: true,
      requester: { select: userSelect },
      recipient: { select: userSelect },
    },
    orderBy: { updatedAt: 'desc' },
  });
  const tAfter = performance.now() - t1;
  console.log(`Optimized getContacts (targeted projection): ${tAfter.toFixed(2)} ms; count: ${rels2.length}`);
  console.log(`Savings: ${(tBefore - tAfter).toFixed(2)} ms (${((1 - tAfter / tBefore) * 100).toFixed(1)}% reduction)!`);

  await prisma.$disconnect();
}

main().catch(console.error);
