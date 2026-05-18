-- Геофенсинг для check-in + универсализация учреждения (садик/школа).

-- Тип учреждения
CREATE TYPE "InstitutionType" AS ENUM ('KINDERGARTEN', 'SCHOOL');

-- Kindergarten: геолокация + тип
ALTER TABLE "Kindergarten"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "checkInRadiusMeters" INTEGER NOT NULL DEFAULT 150,
  ADD COLUMN "type" "InstitutionType" NOT NULL DEFAULT 'KINDERGARTEN';

-- Group: школьный лейбл и параллель
ALTER TABLE "Group"
  ADD COLUMN "gradeLabel" TEXT,
  ADD COLUMN "gradeNumber" INTEGER;

-- TimeEntry: координаты check-in для аудита
ALTER TABLE "TimeEntry"
  ADD COLUMN "checkInLat" DOUBLE PRECISION,
  ADD COLUMN "checkInLon" DOUBLE PRECISION,
  ADD COLUMN "distanceMeters" INTEGER;
