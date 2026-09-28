const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, username: true, displayName: true, nexaVoiceId: true },
  });
  console.log('USERS:', JSON.stringify(users, null, 2));

  const convs = await prisma.conversation.findMany({
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, username: true, displayName: true, nexaVoiceId: true },
          },
        },
      },
      messages: {
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  console.log('CONVERSATIONS COUNT:', convs.length);
  console.log('CONVERSATIONS:', JSON.stringify(convs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
