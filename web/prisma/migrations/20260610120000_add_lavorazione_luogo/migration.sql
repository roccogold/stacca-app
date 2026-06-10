-- CreateTable
CREATE TABLE "Lavorazione" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lavorazione_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Luogo" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Luogo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lavorazione_name_key" ON "Lavorazione"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Luogo_name_key" ON "Luogo"("name");

-- CreateIndex
CREATE INDEX "Luogo_category_idx" ON "Luogo"("category");

-- Enable RLS so Supabase public API roles (anon/authenticated) cannot read/write.
-- Prisma connects as postgres (superuser) and is unaffected.
ALTER TABLE "Lavorazione" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Luogo" ENABLE ROW LEVEL SECURITY;
