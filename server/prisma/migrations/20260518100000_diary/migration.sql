-- Электронный дневник: запись группы на день + индивидуальная заметка о ребёнке.

CREATE TYPE "Mood" AS ENUM ('HAPPY', 'NEUTRAL', 'SAD', 'SICK');
CREATE TYPE "NapQuality" AS ENUM ('GOOD', 'NORMAL', 'POOR', 'NO_NAP');

-- Дневник группы (один на группу+день)
CREATE TABLE "DiaryEntry" (
  "id"         TEXT NOT NULL,
  "groupId"    TEXT NOT NULL,
  "date"       DATE NOT NULL,
  "breakfast"  TEXT,
  "lunch"      TEXT,
  "snack"      TEXT,
  "activities" TEXT,
  "note"       TEXT,
  "authorId"   TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiaryEntry_groupId_date_key" ON "DiaryEntry"("groupId", "date");
CREATE INDEX "DiaryEntry_groupId_idx" ON "DiaryEntry"("groupId");
CREATE INDEX "DiaryEntry_date_idx" ON "DiaryEntry"("date");

ALTER TABLE "DiaryEntry"
  ADD CONSTRAINT "DiaryEntry_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiaryEntry"
  ADD CONSTRAINT "DiaryEntry_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Заметка про ребёнка (один на студент+день)
CREATE TABLE "KidNote" (
  "id"         TEXT NOT NULL,
  "studentId"  TEXT NOT NULL,
  "date"       DATE NOT NULL,
  "mood"       "Mood",
  "napQuality" "NapQuality",
  "note"       TEXT,
  "photoUrls"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "authorId"   TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KidNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KidNote_studentId_date_key" ON "KidNote"("studentId", "date");
CREATE INDEX "KidNote_studentId_idx" ON "KidNote"("studentId");
CREATE INDEX "KidNote_date_idx" ON "KidNote"("date");

ALTER TABLE "KidNote"
  ADD CONSTRAINT "KidNote_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KidNote"
  ADD CONSTRAINT "KidNote_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
