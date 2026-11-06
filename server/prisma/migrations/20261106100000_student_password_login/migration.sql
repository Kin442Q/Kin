-- Для STUDENT: когда классный руководитель выдал логин и пароль.
-- NULL — пароль не выдан, ученик входит только по личной ссылке (как раньше).
ALTER TABLE "User" ADD COLUMN "passwordIssuedAt" TIMESTAMP(3);
