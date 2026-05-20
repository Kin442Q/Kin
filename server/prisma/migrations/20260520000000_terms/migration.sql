-- Учебные периоды (четверти/триместры/полугодия) для школы.

CREATE TYPE "TermType" AS ENUM ('QUARTER', 'TRIMESTER', 'SEMESTER');

CREATE TABLE "Term" (
  "id"             TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "type"           "TermType" NOT NULL DEFAULT 'QUARTER',
  "startDate"      DATE NOT NULL,
  "endDate"        DATE NOT NULL,
  "kindergartenId" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Term_kindergartenId_startDate_idx"
  ON "Term"("kindergartenId", "startDate");

ALTER TABLE "Term"
  ADD CONSTRAINT "Term_kindergartenId_fkey"
  FOREIGN KEY ("kindergartenId") REFERENCES "Kindergarten"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
