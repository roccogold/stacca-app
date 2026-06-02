-- Enable RLS so Supabase public API roles (anon/authenticated) cannot read/write.
-- Prisma connects as postgres (superuser) and is unaffected.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MonthSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
