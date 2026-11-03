-- CreateTable
CREATE TABLE "KindergartenFeature" (
    "id" TEXT NOT NULL,
    "kindergartenId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KindergartenFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KindergartenFeature_kindergartenId_idx" ON "KindergartenFeature"("kindergartenId");

-- CreateIndex
CREATE UNIQUE INDEX "KindergartenFeature_kindergartenId_key_key" ON "KindergartenFeature"("kindergartenId", "key");

-- AddForeignKey
ALTER TABLE "KindergartenFeature" ADD CONSTRAINT "KindergartenFeature_kindergartenId_fkey" FOREIGN KEY ("kindergartenId") REFERENCES "Kindergarten"("id") ON DELETE CASCADE ON UPDATE CASCADE;
