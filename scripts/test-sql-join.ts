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

  console.log('Testing with user ID:', user.id);

  // 1. Benchmark current approach (findUnique + findMany with 3 nested includes)
  const tCurr0 = performance.now();
  const uCurr = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, accountState: true, tokenVersion: true },
  });
  const permsCurr = await prisma.userRoleAssignment.findMany({
    where: { userId: user.id },
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
  const tCurr = performance.now() - tCurr0;
  console.log(`Current approach (5 queries): ${tCurr.toFixed(2)} ms`);

  // 2. Benchmark Single Raw SQL Join (1 query)
  const tRaw0 = performance.now();
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
    WHERE u.id = ${user.id}
  `;
  const tRaw = performance.now() - tRaw0;
  console.log(`Single Raw SQL Join (1 query): ${tRaw.toFixed(2)} ms; rows returned: ${rawResults.length}`);

  if (rawResults.length > 0) {
    const roles = Array.from(new Set(rawResults.map((r) => r.roleName).filter(Boolean)));
    const permissions = Array.from(new Set(rawResults.map((r) => r.permissionAction).filter(Boolean)));
    console.log(`Resolved roles (${roles.length}):`, roles);
    console.log(`Resolved permissions (${permissions.length}):`, permissions.slice(0, 5), '...');
  }

  console.log(`Latency reduction: ${(tCurr - tRaw).toFixed(2)} ms saved per request on miss (${((1 - tRaw / tCurr) * 100).toFixed(1)}% faster)!`);

  await prisma.$disconnect();
}

main().catch(console.error);
