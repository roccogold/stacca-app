-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'dipendente');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lastName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'dipendente';

-- Backfill firstName / lastName from existing displayName (split on first space).
UPDATE "User"
SET "firstName" = split_part("displayName", ' ', 1),
    "lastName" = CASE
      WHEN position(' ' IN "displayName") > 0
        THEN substring("displayName" FROM position(' ' IN "displayName") + 1)
      ELSE ''
    END
WHERE "firstName" = '' AND "displayName" <> '';
