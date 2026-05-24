-- Many-to-many «учитель ведёт несколько классов».
-- Неявная M:N в Prisma → join-таблица _TeacherClasses (A=Group, B=User).

CREATE TABLE "_TeacherClasses" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_TeacherClasses_AB_unique" ON "_TeacherClasses"("A", "B");
CREATE INDEX "_TeacherClasses_B_index" ON "_TeacherClasses"("B");

ALTER TABLE "_TeacherClasses"
  ADD CONSTRAINT "_TeacherClasses_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_TeacherClasses"
  ADD CONSTRAINT "_TeacherClasses_B_fkey"
  FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
