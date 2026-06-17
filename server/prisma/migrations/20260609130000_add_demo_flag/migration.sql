-- Демо-учреждение для «живого демо» на лендинге.
-- Данные демо-тенанта доступны только для просмотра (мутации блокируются
-- на уровне приложения через DemoReadOnlyGuard).
ALTER TABLE "Kindergarten" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
