-- Итоговые оценки за четверть, поставленные учителем: только новая таблица TermGrade.
-- Существующие таблицы и данные не меняются, откат — DROP TABLE "TermGrade".
-- Расчётный итог в базе не хранится: он считается из обычных оценок при каждом запросе.

-- CreateTable
CREATE TABLE "TermGrade" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "setById" TEXT,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermGrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TermGrade_termId_subjectId_idx" ON "TermGrade"("termId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "TermGrade_studentId_subjectId_termId_key" ON "TermGrade"("studentId", "subjectId", "termId");

-- AddForeignKey
ALTER TABLE "TermGrade" ADD CONSTRAINT "TermGrade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermGrade" ADD CONSTRAINT "TermGrade_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermGrade" ADD CONSTRAINT "TermGrade_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermGrade" ADD CONSTRAINT "TermGrade_setById_fkey" FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
