-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContactRelationship_requesterId_status_idx" ON "ContactRelationship"("requesterId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContactRelationship_recipientId_status_idx" ON "ContactRelationship"("recipientId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");
