import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  console.log('Applying performance indexes to Neon PostgreSQL...');

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ContactRelationship_requesterId_status_idx" ON "ContactRelationship"("requesterId", "status");
  `);
  console.log('✓ ContactRelationship(requesterId, status) index verified/created.');

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ContactRelationship_recipientId_status_idx" ON "ContactRelationship"("recipientId", "status");
  `);
  console.log('✓ ContactRelationship(recipientId, status) index verified/created.');

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");
  `);
  console.log('✓ Conversation(updatedAt) index verified/created.');

  // Verify indexes in PostgreSQL pg_indexes
  const indexes: any[] = await prisma.$queryRaw`
    SELECT indexname, tablename, indexdef
    FROM pg_indexes
    WHERE tablename IN ('ContactRelationship', 'Conversation')
    AND indexname IN (
      'ContactRelationship_requesterId_status_idx',
      'ContactRelationship_recipientId_status_idx',
      'Conversation_updatedAt_idx'
    );
  `;
  console.log('\nVerified Indexes in Neon DB:');
  for (const idx of indexes) {
    console.log(`- [${idx.tablename}] ${idx.indexname}: ${idx.indexdef}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
