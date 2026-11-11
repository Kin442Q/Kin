-- Временный пароль, выданный админом, нужно сменить при первом входе.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
