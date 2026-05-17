-- AlterEnum
ALTER TYPE "TimeVerifyMethod" ADD VALUE 'TERMINAL';

-- AlterTable
ALTER TABLE "Kindergarten" ADD COLUMN "terminalApiKey" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "terminalCode" TEXT;

-- CreateIndex (unique)
CREATE UNIQUE INDEX "Kindergarten_terminalApiKey_key" ON "Kindergarten"("terminalApiKey");
CREATE UNIQUE INDEX "User_terminalCode_key" ON "User"("terminalCode");
