-- CreateTable
CREATE TABLE "SearchLog" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "filters" JSONB,
    "userId" TEXT,
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchLog_query_idx" ON "SearchLog"("query");

-- CreateIndex
CREATE INDEX "SearchLog_createdAt_idx" ON "SearchLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "SearchLog_userId_idx" ON "SearchLog"("userId");

-- SearchLog.userId is intentionally NOT a foreign key to allow anonymous logging
