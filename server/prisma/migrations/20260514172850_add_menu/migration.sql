-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'SNACK', 'DINNER');

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "meal" "MealType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "calories" INTEGER,
    "kindergartenId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuItem_kindergartenId_date_idx" ON "MenuItem"("kindergartenId", "date");

-- CreateIndex
CREATE INDEX "MenuItem_date_idx" ON "MenuItem"("date");

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_kindergartenId_fkey" FOREIGN KEY ("kindergartenId") REFERENCES "Kindergarten"("id") ON DELETE CASCADE ON UPDATE CASCADE;
