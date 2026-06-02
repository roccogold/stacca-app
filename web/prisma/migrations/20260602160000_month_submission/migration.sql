-- CreateTable
CREATE TABLE "MonthSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "totalHours" REAL NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonthSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MonthSubmission_userId_idx" ON "MonthSubmission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthSubmission_userId_month_key" ON "MonthSubmission"("userId", "month");
