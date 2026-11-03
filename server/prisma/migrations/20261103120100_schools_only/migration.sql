-- Платформа только для школ.
-- 1) новые учреждения по умолчанию — школы
ALTER TABLE "Kindergarten" ALTER COLUMN "type" SET DEFAULT 'SCHOOL';

-- 2) существующие детские сады становятся школами (данные не удаляются:
--    группы → классы, дети → ученики, меняются только подписи в интерфейсе)
UPDATE "Kindergarten" SET "type" = 'SCHOOL' WHERE "type" = 'KINDERGARTEN';
