-- CreateEnum
CREATE TYPE "SalaryMode" AS ENUM ('HOURLY', 'FIXED');

-- CreateEnum
CREATE TYPE "TimeVerifyMethod" AS ENUM ('MANUAL', 'FACE', 'PIN', 'QR');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "faceDescriptor" JSONB,
ADD COLUMN     "hourlyRate" DECIMAL(10,2),
ADD COLUMN     "monthlySalaryFixed" DECIMAL(12,2),
ADD COLUMN     "salaryMode" "SalaryMode" NOT NULL DEFAULT 'HOURLY',
ADD COLUMN     "workNorm" INTEGER NOT NULL DEFAULT 176;

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3),
    "minutesWorked" INTEGER,
    "verifyMethod" "TimeVerifyMethod" NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "editedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeEntry_userId_date_idx" ON "TimeEntry"("userId", "date");

-- CreateIndex
CREATE INDEX "TimeEntry_date_idx" ON "TimeEntry"("date");

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
