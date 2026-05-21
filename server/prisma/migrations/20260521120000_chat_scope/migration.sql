-- Раздельные каналы чата: GENERAL (учитель) и ADMIN (финансы) + тип сообщения.

CREATE TYPE "ConversationScope" AS ENUM ('GENERAL', 'ADMIN');
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'PAYMENT');

-- Conversation.scope
ALTER TABLE "Conversation"
  ADD COLUMN "scope" "ConversationScope" NOT NULL DEFAULT 'GENERAL';

-- Меняем уникальный индекс: было (groupId, parentId) → стало (groupId, parentId, scope)
DROP INDEX IF EXISTS "Conversation_groupId_parentId_key";
CREATE UNIQUE INDEX "Conversation_groupId_parentId_scope_key"
  ON "Conversation"("groupId", "parentId", "scope");

-- Message.kind
ALTER TABLE "Message"
  ADD COLUMN "kind" "MessageKind" NOT NULL DEFAULT 'TEXT';
