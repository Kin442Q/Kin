-- AlterTable
ALTER TABLE "User" ADD COLUMN     "kindergartenId" TEXT;

-- CreateTable
CREATE TABLE "Kindergarten" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kindergarten_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Kindergarten_slug_key" ON "Kindergarten"("slug");

-- CreateIndex
CREATE INDEX "Kindergarten_isActive_idx" ON "Kindergarten"("isActive");

-- CreateIndex
CREATE INDEX "User_kindergartenId_idx" ON "User"("kindergartenId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_kindergartenId_fkey" FOREIGN KEY ("kindergartenId") REFERENCES "Kindergarten"("id") ON DELETE CASCADE ON UPDATE CASCADE;
