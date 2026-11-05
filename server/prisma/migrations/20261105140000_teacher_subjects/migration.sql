-- Предметы, открытые учителю (M:N). Учитель видит в журнале и ДЗ только их.
-- Неявная M:N в Prisma → join-таблица _TeacherSubjects (A=Subject, B=User).
-- Существующих учителей не заполняем: админ сам открывает предметы в разделе «Доступ учителей».

CREATE TABLE "_TeacherSubjects" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_TeacherSubjects_AB_unique" ON "_TeacherSubjects"("A", "B");
CREATE INDEX "_TeacherSubjects_B_index" ON "_TeacherSubjects"("B");

ALTER TABLE "_TeacherSubjects"
  ADD CONSTRAINT "_TeacherSubjects_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_TeacherSubjects"
  ADD CONSTRAINT "_TeacherSubjects_B_fkey"
  FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
