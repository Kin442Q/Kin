-- Ежемесячный вердикт родителю по предметам: только новые таблицы (вердикты и пороги школы).
-- Существующие таблицы и данные не меняются, откат — DROP двух таблиц и типа VerdictStatus.

-- CreateEnum
CREATE TYPE "VerdictStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'SKIPPED');

-- CreateTable
CREATE TABLE "ParentVerdict" (
    "id" TEXT NOT NULL,
    "kindergartenId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "asOf" TEXT NOT NULL,
    "status" "VerdictStatus" NOT NULL DEFAULT 'DRAFT',
    "scale" "GradeScale" NOT NULL,
    "thresholds" JSONB NOT NULL,
    "signals" JSONB NOT NULL,
    "focusSubjectId" TEXT,
    "draftRu" TEXT NOT NULL,
    "draftTg" TEXT NOT NULL,
    "textRu" TEXT NOT NULL,
    "textTg" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL DEFAULT 'template',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "skipReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentVerdict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerdictConfig" (
    "id" TEXT NOT NULL,
    "kindergartenId" TEXT NOT NULL,
    "overrides" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerdictConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParentVerdict_groupId_month_idx" ON "ParentVerdict"("groupId", "month");

-- CreateIndex
CREATE INDEX "ParentVerdict_kindergartenId_month_idx" ON "ParentVerdict"("kindergartenId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ParentVerdict_studentId_month_key" ON "ParentVerdict"("studentId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "VerdictConfig_kindergartenId_key" ON "VerdictConfig"("kindergartenId");

-- AddForeignKey
ALTER TABLE "ParentVerdict" ADD CONSTRAINT "ParentVerdict_kindergartenId_fkey" FOREIGN KEY ("kindergartenId") REFERENCES "Kindergarten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentVerdict" ADD CONSTRAINT "ParentVerdict_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentVerdict" ADD CONSTRAINT "ParentVerdict_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentVerdict" ADD CONSTRAINT "ParentVerdict_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerdictConfig" ADD CONSTRAINT "VerdictConfig_kindergartenId_fkey" FOREIGN KEY ("kindergartenId") REFERENCES "Kindergarten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

