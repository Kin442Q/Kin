-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "kindergartenId" TEXT;

-- AlterTable
ALTER TABLE "ExtraIncome" ADD COLUMN     "kindergartenId" TEXT;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "kindergartenId" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "kindergartenId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_kindergartenId_idx" ON "Expense"("kindergartenId");

-- CreateIndex
CREATE INDEX "ExtraIncome_kindergartenId_idx" ON "ExtraIncome"("kindergartenId");

-- CreateIndex
CREATE INDEX "Group_kindergartenId_idx" ON "Group"("kindergartenId");

-- CreateIndex
CREATE INDEX "Student_kindergartenId_idx" ON "Student"("kindergartenId");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_kindergartenId_fkey" FOREIGN KEY ("kindergartenId") REFERENCES "Kindergarten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_kindergartenId_fkey" FOREIGN KEY ("kindergartenId") REFERENCES "Kindergarten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraIncome" ADD CONSTRAINT "ExtraIncome_kindergartenId_fkey" FOREIGN KEY ("kindergartenId") REFERENCES "Kindergarten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_kindergartenId_fkey" FOREIGN KEY ("kindergartenId") REFERENCES "Kindergarten"("id") ON DELETE CASCADE ON UPDATE CASCADE;
