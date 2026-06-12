-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserArea" (
    "userId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,

    CONSTRAINT "UserArea_pkey" PRIMARY KEY ("userId","areaId")
);

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN "area" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Lavorazione" ADD COLUMN "areaId" TEXT;

-- AlterTable
ALTER TABLE "Luogo" ADD COLUMN "areaId" TEXT;

-- DropIndex: global name uniqueness replaced by per-area uniqueness
DROP INDEX "Lavorazione_name_key";
DROP INDEX "Luogo_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "Area_name_key" ON "Area"("name");
CREATE INDEX "UserArea_areaId_idx" ON "UserArea"("areaId");
CREATE INDEX "Lavorazione_areaId_idx" ON "Lavorazione"("areaId");
CREATE UNIQUE INDEX "Lavorazione_areaId_name_key" ON "Lavorazione"("areaId", "name");
CREATE INDEX "Luogo_areaId_idx" ON "Luogo"("areaId");
CREATE UNIQUE INDEX "Luogo_areaId_name_key" ON "Luogo"("areaId", "name");

-- AddForeignKey
ALTER TABLE "UserArea" ADD CONSTRAINT "UserArea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserArea" ADD CONSTRAINT "UserArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lavorazione" ADD CONSTRAINT "Lavorazione_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Luogo" ADD CONSTRAINT "Luogo_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS so Supabase public API roles (anon/authenticated) cannot read/write.
ALTER TABLE "Area" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserArea" ENABLE ROW LEVEL SECURITY;
