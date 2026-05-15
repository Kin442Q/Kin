-- CreateEnum
CREATE TYPE "StaffPosition" AS ENUM ('TEACHER_ASSISTANT', 'HEAD_MASTER', 'METHODIST', 'NURSE', 'COOK', 'PSYCHOLOGIST', 'MUSIC_TEACHER', 'GUARD', 'CLEANER', 'OTHER');

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "middleName" TEXT,
    "position" "StaffPosition" NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "groupId" TEXT,
    "salary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "kindergartenId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Staff_kindergartenId_idx" ON "Staff"("kindergartenId");

-- CreateIndex
CREATE INDEX "Staff_position_idx" ON "Staff"("position");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_kindergartenId_fkey" FOREIGN KEY ("kindergartenId") REFERENCES "Kindergarten"("id") ON DELETE CASCADE ON UPDATE CASCADE;
