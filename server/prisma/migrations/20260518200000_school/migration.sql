-- Школьная функциональность: предметы, оценки, домашние задания.

CREATE TYPE "GradeType" AS ENUM (
  'CLASSWORK', 'HOMEWORK', 'CONTROL', 'EXAM', 'PROJECT', 'OTHER'
);

-- Расширение ScheduleItem
ALTER TABLE "ScheduleItem"
  ADD COLUMN "subjectId" TEXT,
  ADD COLUMN "teacherId" TEXT,
  ADD COLUMN "room"      TEXT;

CREATE INDEX "ScheduleItem_subjectId_idx" ON "ScheduleItem"("subjectId");
CREATE INDEX "ScheduleItem_teacherId_idx" ON "ScheduleItem"("teacherId");

-- Subject
CREATE TABLE "Subject" (
  "id"             TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "color"          TEXT NOT NULL DEFAULT '#4FB286',
  "kindergartenId" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subject_kindergartenId_name_key"
  ON "Subject"("kindergartenId", "name");
CREATE INDEX "Subject_kindergartenId_idx" ON "Subject"("kindergartenId");

ALTER TABLE "Subject"
  ADD CONSTRAINT "Subject_kindergartenId_fkey"
  FOREIGN KEY ("kindergartenId") REFERENCES "Kindergarten"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduleItem"
  ADD CONSTRAINT "ScheduleItem_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Grade
CREATE TABLE "Grade" (
  "id"         TEXT NOT NULL,
  "studentId"  TEXT NOT NULL,
  "subjectId"  TEXT NOT NULL,
  "value"      INTEGER NOT NULL,
  "type"       "GradeType" NOT NULL DEFAULT 'CLASSWORK',
  "date"       DATE NOT NULL,
  "comment"    TEXT,
  "authorId"   TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Grade_studentId_idx" ON "Grade"("studentId");
CREATE INDEX "Grade_subjectId_idx" ON "Grade"("subjectId");
CREATE INDEX "Grade_studentId_subjectId_date_idx"
  ON "Grade"("studentId", "subjectId", "date");
CREATE INDEX "Grade_date_idx" ON "Grade"("date");

ALTER TABLE "Grade"
  ADD CONSTRAINT "Grade_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Grade"
  ADD CONSTRAINT "Grade_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Grade"
  ADD CONSTRAINT "Grade_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

-- Homework
CREATE TABLE "Homework" (
  "id"          TEXT NOT NULL,
  "subjectId"   TEXT NOT NULL,
  "groupId"     TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "dueDate"     DATE NOT NULL,
  "attachments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "authorId"    TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Homework_groupId_dueDate_idx" ON "Homework"("groupId", "dueDate");
CREATE INDEX "Homework_subjectId_idx" ON "Homework"("subjectId");

ALTER TABLE "Homework"
  ADD CONSTRAINT "Homework_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Homework"
  ADD CONSTRAINT "Homework_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "Group"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Homework"
  ADD CONSTRAINT "Homework_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
