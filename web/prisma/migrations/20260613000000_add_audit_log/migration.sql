-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- Enable RLS so Supabase public API roles (anon/authenticated) cannot read/write.
-- Prisma connects as postgres (superuser) and is unaffected; the Supabase
-- dashboard (service role) can still browse the rows.
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
