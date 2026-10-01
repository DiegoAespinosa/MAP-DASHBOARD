-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('CARGA_EVIDENCIA', 'RANKING');

-- CreateEnum
CREATE TYPE "RefreshStatus" AS ENUM ('RUNNING', 'OK', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "exportUrl" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lastRefreshAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "lastOverallScore" DOUBLE PRECISION,
    "lastRecordCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Indicator" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "section" TEXT,
    "score" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "weightedResult" DOUBLE PRECISION,
    "color" TEXT,
    "status" TEXT,
    "deadline" DATE,
    "deadlineOverdue" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "missingSince" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Indicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dueDate" DATE,
    "verifiedBy" TEXT,
    "value" DOUBLE PRECISION,
    "status" TEXT,
    "externalRef" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "missingSince" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "indicatorId" TEXT NOT NULL,
    "responsible" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("indicatorId")
);

-- CreateTable
CREATE TABLE "Refresh" (
    "id" TEXT NOT NULL,
    "status" "RefreshStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "heartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" JSONB,
    "summary" JSONB,
    "snapshot" JSONB,
    "error" TEXT,

    CONSTRAINT "Refresh_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Indicator_deadline_idx" ON "Indicator"("deadline");

-- CreateIndex
CREATE UNIQUE INDEX "Indicator_sourceId_code_key" ON "Indicator"("sourceId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_indicatorId_code_key" ON "Evidence"("indicatorId", "code");

-- CreateIndex
CREATE INDEX "Refresh_startedAt_idx" ON "Refresh"("startedAt");

-- AddForeignKey
ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

