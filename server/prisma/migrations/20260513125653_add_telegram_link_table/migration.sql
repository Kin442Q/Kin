-- CreateTable
CREATE TABLE "TelegramLink" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelegramLink_studentId_idx" ON "TelegramLink"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_studentId_chatId_key" ON "TelegramLink"("studentId", "chatId");

-- AddForeignKey
ALTER TABLE "TelegramLink" ADD CONSTRAINT "TelegramLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
