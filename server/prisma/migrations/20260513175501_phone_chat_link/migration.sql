/*
  Warnings:

  - You are about to drop the `TelegramLink` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TelegramLink" DROP CONSTRAINT "TelegramLink_studentId_fkey";

-- DropTable
DROP TABLE "TelegramLink";

-- CreateTable
CREATE TABLE "PhoneChatLink" (
    "id" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "fullName" TEXT,
    "username" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneChatLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhoneChatLink_phoneNormalized_key" ON "PhoneChatLink"("phoneNormalized");

-- CreateIndex
CREATE INDEX "PhoneChatLink_chatId_idx" ON "PhoneChatLink"("chatId");
