-- Личные переписки учитель ↔ родитель.
-- Раньше переписка GENERAL была одна на пару «класс + родитель», поэтому её видели
-- все учителя класса. Теперь у переписки есть собеседник-учитель (teacherId),
-- и видят её только он и родитель.
--
-- Что делает миграция:
--  1) добавляет Conversation.teacherId (необязательная колонка, FK на User, SET NULL);
--  2) заполняет её у старых GENERAL-переписок (см. ниже, три шага);
--  3) заменяет уникальный индекс (groupId, parentId, scope) на (…, teacherId):
--     иначе два учителя одного класса не смогли бы писать одному родителю;
--  4) частичным уникальным индексом сохраняет «одна переписка с администрацией»
--     на (класс, родитель): в Postgres NULL в обычном уникальном индексе не совпадают.
--
-- Данные не удаляются и не переносятся. Откат вручную: DROP частичного индекса и нового
-- уникального, DROP COLUMN "teacherId", потом создать старый уникальный индекс —
-- он создастся только если после миграции не появилось двух переписок
-- с одним (класс, родитель, канал).

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "teacherId" TEXT;

-- AddForeignKey
ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Шаг 1 бэкфилла: собеседник — учитель, который отвечал в этой переписке последним.
UPDATE "Conversation" c
SET "teacherId" = s."senderId"
FROM (
  SELECT DISTINCT ON (m."conversationId") m."conversationId", m."senderId"
  FROM "Message" m
  JOIN "User" u ON u."id" = m."senderId" AND u."role" = 'TEACHER'
  ORDER BY m."conversationId", m."createdAt" DESC
) s
WHERE c."id" = s."conversationId"
  AND c."scope" = 'GENERAL'
  AND c."teacherId" IS NULL;

-- Шаг 2: учитель не отвечал — классный руководитель класса (если назначен).
UPDATE "Conversation" c
SET "teacherId" = g."homeroomTeacherId"
FROM "Group" g
WHERE g."id" = c."groupId"
  AND c."scope" = 'GENERAL'
  AND c."teacherId" IS NULL
  AND g."homeroomTeacherId" IS NOT NULL;

-- Шаг 3: классного нет — единственный активный учитель класса (основная группа или M:N).
UPDATE "Conversation" c
SET "teacherId" = t."teacherId"
FROM (
  SELECT x."groupId", MIN(x."teacherId") AS "teacherId"
  FROM (
    SELECT u."groupId" AS "groupId", u."id" AS "teacherId"
    FROM "User" u
    WHERE u."role" = 'TEACHER' AND u."isActive" AND u."groupId" IS NOT NULL
    UNION
    SELECT tc."A" AS "groupId", tc."B" AS "teacherId"
    FROM "_TeacherClasses" tc
    JOIN "User" u ON u."id" = tc."B" AND u."role" = 'TEACHER' AND u."isActive"
  ) x
  GROUP BY x."groupId"
  HAVING COUNT(*) = 1
) t
WHERE t."groupId" = c."groupId"
  AND c."scope" = 'GENERAL'
  AND c."teacherId" IS NULL;
-- Остальные (собеседника определить нельзя) остаются с teacherId = NULL:
-- ни один учитель их не увидит, родитель получит новую переписку при первом сообщении.

-- Уникальность: старый индекс вон, новый с teacherId.
DROP INDEX "Conversation_groupId_parentId_scope_key";

CREATE UNIQUE INDEX "Conversation_groupId_parentId_scope_teacherId_key"
  ON "Conversation"("groupId", "parentId", "scope", "teacherId");

-- Канал с администрацией (teacherId = NULL): одна переписка на (класс, родитель).
CREATE UNIQUE INDEX "Conversation_admin_channel_key"
  ON "Conversation"("groupId", "parentId")
  WHERE "scope" = 'ADMIN';

-- CreateIndex
CREATE INDEX "Conversation_teacherId_scope_idx" ON "Conversation"("teacherId", "scope");
