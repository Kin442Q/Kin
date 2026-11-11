-- CreateEnum
CREATE TYPE "GradeScale" AS ENUM ('FIVE', 'TEN');

-- CreateEnum
CREATE TYPE "DistrictKind" AS ENUM ('DISTRICT', 'CITY', 'CITY_DISTRICT');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'VIEWER';

-- AlterTable
ALTER TABLE "Kindergarten" ADD COLUMN     "districtId" TEXT,
ADD COLUMN     "gradeScale" "GradeScale" NOT NULL DEFAULT 'FIVE';

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameTg" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "centerRu" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "DistrictKind" NOT NULL DEFAULT 'DISTRICT',
    "nameRu" TEXT NOT NULL,
    "nameTg" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewerScope" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "allSchools" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViewerScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RegionToViewerScope" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_DistrictToViewerScope" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE UNIQUE INDEX "District_code_key" ON "District"("code");

-- CreateIndex
CREATE INDEX "District_regionId_idx" ON "District"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "ViewerScope_userId_key" ON "ViewerScope"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "_RegionToViewerScope_AB_unique" ON "_RegionToViewerScope"("A", "B");

-- CreateIndex
CREATE INDEX "_RegionToViewerScope_B_index" ON "_RegionToViewerScope"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_DistrictToViewerScope_AB_unique" ON "_DistrictToViewerScope"("A", "B");

-- CreateIndex
CREATE INDEX "_DistrictToViewerScope_B_index" ON "_DistrictToViewerScope"("B");

-- CreateIndex
CREATE INDEX "Kindergarten_districtId_idx" ON "Kindergarten"("districtId");

-- AddForeignKey
ALTER TABLE "Kindergarten" ADD CONSTRAINT "Kindergarten_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerScope" ADD CONSTRAINT "ViewerScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RegionToViewerScope" ADD CONSTRAINT "_RegionToViewerScope_A_fkey" FOREIGN KEY ("A") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RegionToViewerScope" ADD CONSTRAINT "_RegionToViewerScope_B_fkey" FOREIGN KEY ("B") REFERENCES "ViewerScope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DistrictToViewerScope" ADD CONSTRAINT "_DistrictToViewerScope_A_fkey" FOREIGN KEY ("A") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DistrictToViewerScope" ADD CONSTRAINT "_DistrictToViewerScope_B_fkey" FOREIGN KEY ("B") REFERENCES "ViewerScope"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Справочник областей и районов Таджикистана (источник: prisma/data/tajikistan-regions.json).
-- Записи создаются здесь; правки справочника — отдельной миграцией с теми же кодами.
INSERT INTO "Region" ("id", "code", "nameRu", "nameTg", "nameEn", "centerRu", "sortOrder") VALUES
  ('rg_dushanbe', 'DUSHANBE', 'город Душанбе', 'шаҳри Душанбе', 'Dushanbe city', 'Душанбе', 10),
  ('rg_gbao', 'GBAO', 'Горно-Бадахшанская автономная область', 'Вилояти Мухтори Кӯҳистони Бадахшон', 'Gorno-Badakhshan Autonomous Region (GBAO)', 'Хорог', 20),
  ('rg_sughd', 'SUGHD', 'Согдийская область', 'Вилояти Суғд', 'Sughd Region', 'Худжанд', 30),
  ('rg_khatlon', 'KHATLON', 'Хатлонская область', 'Вилояти Хатлон', 'Khatlon Region', 'Бохтар', 40),
  ('rg_drs', 'DRS', 'Районы республиканского подчинения', 'Ноҳияҳои тобеи ҷумҳурӣ', 'Districts of Republican Subordination (DRS)', 'Душанбе', 50);

INSERT INTO "District" ("id", "regionId", "code", "kind", "nameRu", "nameTg", "nameEn", "sortOrder") VALUES
  ('ds_dushanbe_ismoili_somoni', 'rg_dushanbe', 'DUSHANBE-ISMOILI-SOMONI', 'CITY_DISTRICT', 'район Исмоили Сомони', 'ноҳияи Исмоили Сомонӣ', 'Ismoili Somoni district', 1),
  ('ds_dushanbe_sino', 'rg_dushanbe', 'DUSHANBE-SINO', 'CITY_DISTRICT', 'район Сино', 'ноҳияи Сино', 'Sino (Ibn Sina) district', 2),
  ('ds_dushanbe_firdavsi', 'rg_dushanbe', 'DUSHANBE-FIRDAVSI', 'CITY_DISTRICT', 'район Фирдавси', 'ноҳияи Фирдавсӣ', 'Firdavsi district', 3),
  ('ds_dushanbe_shohmansur', 'rg_dushanbe', 'DUSHANBE-SHOHMANSUR', 'CITY_DISTRICT', 'район Шохмансур', 'ноҳияи Шоҳмансур', 'Shohmansur district', 4),
  ('ds_gbao_khorog_city', 'rg_gbao', 'GBAO-KHOROG-CITY', 'CITY', 'город Хорог', 'шаҳри Хоруғ', 'Khorugh city', 1),
  ('ds_gbao_vanj', 'rg_gbao', 'GBAO-VANJ', 'DISTRICT', 'Ванчский район', 'ноҳияи Ванҷ', 'Vanj district', 2),
  ('ds_gbao_darvoz', 'rg_gbao', 'GBAO-DARVOZ', 'DISTRICT', 'Дарвазский район', 'ноҳияи Дарвоз', 'Darvoz district', 3),
  ('ds_gbao_ishkoshim', 'rg_gbao', 'GBAO-ISHKOSHIM', 'DISTRICT', 'Ишкашимский район', 'ноҳияи Ишкошим', 'Ishkoshim district', 4),
  ('ds_gbao_murghob', 'rg_gbao', 'GBAO-MURGHOB', 'DISTRICT', 'Мургабский район', 'ноҳияи Мурғоб', 'Murghob district', 5),
  ('ds_gbao_roshtqala', 'rg_gbao', 'GBAO-ROSHTQALA', 'DISTRICT', 'Рошткалинский район', 'ноҳияи Роштқалъа', 'Roshtqal''a district', 6),
  ('ds_gbao_rushon', 'rg_gbao', 'GBAO-RUSHON', 'DISTRICT', 'Рушанский район', 'ноҳияи Рӯшон', 'Rushon district', 7),
  ('ds_gbao_shughnon', 'rg_gbao', 'GBAO-SHUGHNON', 'DISTRICT', 'Шугнанский район', 'ноҳияи Шуғнон', 'Shughnon district', 8),
  ('ds_sughd_khujand_city', 'rg_sughd', 'SUGHD-KHUJAND-CITY', 'CITY', 'город Худжанд', 'шаҳри Хуҷанд', 'Khujand city', 1),
  ('ds_sughd_buston_city', 'rg_sughd', 'SUGHD-BUSTON-CITY', 'CITY', 'город Бустон', 'шаҳри Бӯстон', 'Buston city', 2),
  ('ds_sughd_guliston_city', 'rg_sughd', 'SUGHD-GULISTON-CITY', 'CITY', 'город Гулистон', 'шаҳри Гулистон', 'Guliston city', 3),
  ('ds_sughd_isfara_city', 'rg_sughd', 'SUGHD-ISFARA-CITY', 'CITY', 'город Исфара', 'шаҳри Исфара', 'Isfara city', 4),
  ('ds_sughd_istaravshan_city', 'rg_sughd', 'SUGHD-ISTARAVSHAN-CITY', 'CITY', 'город Истаравшан', 'шаҳри Истаравшан', 'Istaravshan city', 5),
  ('ds_sughd_istiqlol_city', 'rg_sughd', 'SUGHD-ISTIQLOL-CITY', 'CITY', 'город Истиклол', 'шаҳри Истиқлол', 'Istiqlol city', 6),
  ('ds_sughd_konibodom_city', 'rg_sughd', 'SUGHD-KONIBODOM-CITY', 'CITY', 'город Канибадам', 'шаҳри Конибодом', 'Konibodom city', 7),
  ('ds_sughd_panjakent_city', 'rg_sughd', 'SUGHD-PANJAKENT-CITY', 'CITY', 'город Пенджикент', 'шаҳри Панҷакент', 'Panjakent city', 8),
  ('ds_sughd_ayni', 'rg_sughd', 'SUGHD-AYNI', 'DISTRICT', 'Айнинский район', 'ноҳияи Айнӣ', 'Ayni district', 9),
  ('ds_sughd_asht', 'rg_sughd', 'SUGHD-ASHT', 'DISTRICT', 'Аштский район', 'ноҳияи Ашт', 'Asht district', 10),
  ('ds_sughd_ghafurov', 'rg_sughd', 'SUGHD-GHAFUROV', 'DISTRICT', 'Гафуровский район', 'ноҳияи Ғафуров', 'Ghafurov district', 11),
  ('ds_sughd_kuhistoni_mastchoh', 'rg_sughd', 'SUGHD-KUHISTONI-MASTCHOH', 'DISTRICT', 'Горно-Матчинский район', 'ноҳияи Кӯҳистони Мастчоҳ', 'Kuhistoni Mastchoh district', 12),
  ('ds_sughd_devashtich', 'rg_sughd', 'SUGHD-DEVASHTICH', 'DISTRICT', 'район Деваштич', 'ноҳияи Деваштич', 'Devashtich district', 13),
  ('ds_sughd_jabbor_rasulov', 'rg_sughd', 'SUGHD-JABBOR-RASULOV', 'DISTRICT', 'Джаббар-Расуловский район', 'ноҳияи Ҷаббор Расулов', 'Jabbor Rasulov district', 14),
  ('ds_sughd_zafarobod', 'rg_sughd', 'SUGHD-ZAFAROBOD', 'DISTRICT', 'Зафарабадский район', 'ноҳияи Зафаробод', 'Zafarobod district', 15),
  ('ds_sughd_mastchoh', 'rg_sughd', 'SUGHD-MASTCHOH', 'DISTRICT', 'Матчинский район', 'ноҳияи Мастчоҳ', 'Mastchoh district', 16),
  ('ds_sughd_spitamen', 'rg_sughd', 'SUGHD-SPITAMEN', 'DISTRICT', 'Спитаменский район', 'ноҳияи Спитамен', 'Spitamen district', 17),
  ('ds_sughd_shahriston', 'rg_sughd', 'SUGHD-SHAHRISTON', 'DISTRICT', 'Шахристанский район', 'ноҳияи Шаҳристон', 'Shahriston district', 18),
  ('ds_khatlon_bokhtar_city', 'rg_khatlon', 'KHATLON-BOKHTAR-CITY', 'CITY', 'город Бохтар', 'шаҳри Бохтар', 'Bokhtar city', 1),
  ('ds_khatlon_kulob_city', 'rg_khatlon', 'KHATLON-KULOB-CITY', 'CITY', 'город Куляб', 'шаҳри Кӯлоб', 'Kulob city', 2),
  ('ds_khatlon_levakant_city', 'rg_khatlon', 'KHATLON-LEVAKANT-CITY', 'CITY', 'город Левакант', 'шаҳри Левакант', 'Levakant city', 3),
  ('ds_khatlon_norek_city', 'rg_khatlon', 'KHATLON-NOREK-CITY', 'CITY', 'город Нурек', 'шаҳри Норак', 'Norak (Nurek) city', 4),
  ('ds_khatlon_jomi', 'rg_khatlon', 'KHATLON-JOMI', 'DISTRICT', 'район Абдурахмони Джоми', 'ноҳияи Абдураҳмони Ҷомӣ', 'Abdurahmoni Jomi district', 5),
  ('ds_khatlon_baljuvon', 'rg_khatlon', 'KHATLON-BALJUVON', 'DISTRICT', 'Бальджуванский район', 'ноҳияи Балҷувон', 'Baljuvon district', 6),
  ('ds_khatlon_vakhsh', 'rg_khatlon', 'KHATLON-VAKHSH', 'DISTRICT', 'Вахшский район', 'ноҳияи Вахш', 'Vakhsh district', 7),
  ('ds_khatlon_vose', 'rg_khatlon', 'KHATLON-VOSE', 'DISTRICT', 'Восейский район', 'ноҳияи Восеъ', 'Vose'' district', 8),
  ('ds_khatlon_danghara', 'rg_khatlon', 'KHATLON-DANGHARA', 'DISTRICT', 'Дангаринский район', 'ноҳияи Данғара', 'Danghara district', 9),
  ('ds_khatlon_jayhun', 'rg_khatlon', 'KHATLON-JAYHUN', 'DISTRICT', 'район Джайхун', 'ноҳияи Ҷайҳун', 'Jayhun district', 10),
  ('ds_khatlon_jaloliddin_balkhi', 'rg_khatlon', 'KHATLON-JALOLIDDIN-BALKHI', 'DISTRICT', 'район Джалолиддина Балхи', 'ноҳияи Ҷалолиддин Балхӣ', 'Jaloliddin Balkhi district', 11),
  ('ds_khatlon_dusti', 'rg_khatlon', 'KHATLON-DUSTI', 'DISTRICT', 'район Дусти', 'ноҳияи Дӯстӣ', 'Dusti district', 12),
  ('ds_khatlon_qubodiyon', 'rg_khatlon', 'KHATLON-QUBODIYON', 'DISTRICT', 'Кубодиёнский район', 'ноҳияи Қубодиён', 'Qubodiyon district', 13),
  ('ds_khatlon_kushoniyon', 'rg_khatlon', 'KHATLON-KUSHONIYON', 'DISTRICT', 'район Кушониён', 'ноҳияи Кӯшониён', 'Kushoniyon district', 14),
  ('ds_khatlon_muminobod', 'rg_khatlon', 'KHATLON-MUMINOBOD', 'DISTRICT', 'Муминабадский район', 'ноҳияи Мӯъминобод', 'Mu''minobod district', 15),
  ('ds_khatlon_nosiri_khusrav', 'rg_khatlon', 'KHATLON-NOSIRI-KHUSRAV', 'DISTRICT', 'Носири-Хусравский район', 'ноҳияи Носири Хусрав', 'Nosiri Khusrav district', 16),
  ('ds_khatlon_panj', 'rg_khatlon', 'KHATLON-PANJ', 'DISTRICT', 'Пянджский район', 'ноҳияи Панҷ', 'Panj district', 17),
  ('ds_khatlon_temurmalik', 'rg_khatlon', 'KHATLON-TEMURMALIK', 'DISTRICT', 'Темурмаликский район', 'ноҳияи Темурмалик', 'Temurmalik district', 18),
  ('ds_khatlon_farkhor', 'rg_khatlon', 'KHATLON-FARKHOR', 'DISTRICT', 'Фархорский район', 'ноҳияи Фархор', 'Farkhor district', 19),
  ('ds_khatlon_hamadoni', 'rg_khatlon', 'KHATLON-HAMADONI', 'DISTRICT', 'район Хамадони', 'ноҳияи Ҳамадонӣ', 'Hamadoni district', 20),
  ('ds_khatlon_khovaling', 'rg_khatlon', 'KHATLON-KHOVALING', 'DISTRICT', 'Ховалингский район', 'ноҳияи Ховалинг', 'Khovaling district', 21),
  ('ds_khatlon_khuroson', 'rg_khatlon', 'KHATLON-KHUROSON', 'DISTRICT', 'Хуросонский район', 'ноҳияи Хуросон', 'Khuroson district', 22),
  ('ds_khatlon_shahritus', 'rg_khatlon', 'KHATLON-SHAHRITUS', 'DISTRICT', 'Шахритусский район', 'ноҳияи Шаҳритӯс', 'Shahritus district', 23),
  ('ds_khatlon_shamsiddin_shohin', 'rg_khatlon', 'KHATLON-SHAMSIDDIN-SHOHIN', 'DISTRICT', 'район Шамсиддина Шохина', 'ноҳияи Шамсиддин Шоҳин', 'Shamsiddin Shohin district', 24),
  ('ds_khatlon_yovon', 'rg_khatlon', 'KHATLON-YOVON', 'DISTRICT', 'Яванский район', 'ноҳияи Ёвон', 'Yovon district', 25),
  ('ds_drs_vahdat_city', 'rg_drs', 'DRS-VAHDAT-CITY', 'CITY', 'город Вахдат', 'шаҳри Ваҳдат', 'Vahdat city', 1),
  ('ds_drs_hisor_city', 'rg_drs', 'DRS-HISOR-CITY', 'CITY', 'город Гиссар', 'шаҳри Ҳисор', 'Hisor city', 2),
  ('ds_drs_roghun_city', 'rg_drs', 'DRS-ROGHUN-CITY', 'CITY', 'город Рогун', 'шаҳри Роғун', 'Roghun city', 3),
  ('ds_drs_tursunzoda_city', 'rg_drs', 'DRS-TURSUNZODA-CITY', 'CITY', 'город Турсунзаде', 'шаҳри Турсунзода', 'Tursunzoda city', 4),
  ('ds_drs_varzob', 'rg_drs', 'DRS-VARZOB', 'DISTRICT', 'Варзобский район', 'ноҳияи Варзоб', 'Varzob district', 5),
  ('ds_drs_vahdat', 'rg_drs', 'DRS-VAHDAT', 'DISTRICT', 'Вахдатский район', 'ноҳияи Ваҳдат', 'Vahdat district', 6),
  ('ds_drs_hisor', 'rg_drs', 'DRS-HISOR', 'DISTRICT', 'Гиссарский район', 'ноҳияи Ҳисор', 'Hisor district', 7),
  ('ds_drs_lakhsh', 'rg_drs', 'DRS-LAKHSH', 'DISTRICT', 'Лахшский район', 'ноҳияи Лахш', 'Lakhsh district', 8),
  ('ds_drs_nurobod', 'rg_drs', 'DRS-NUROBOD', 'DISTRICT', 'Нурабадский район', 'ноҳияи Нуробод', 'Nurobod district', 9),
  ('ds_drs_rasht', 'rg_drs', 'DRS-RASHT', 'DISTRICT', 'Раштский район', 'ноҳияи Рашт', 'Rasht district', 10),
  ('ds_drs_roghun', 'rg_drs', 'DRS-ROGHUN', 'DISTRICT', 'Рогунский район', 'ноҳияи Роғун', 'Roghun district', 11),
  ('ds_drs_rudaki', 'rg_drs', 'DRS-RUDAKI', 'DISTRICT', 'район Рудаки', 'ноҳияи Рӯдакӣ', 'Rudaki district', 12),
  ('ds_drs_sangvor', 'rg_drs', 'DRS-SANGVOR', 'DISTRICT', 'район Сангвор', 'ноҳияи Сангвор', 'Sangvor district', 13),
  ('ds_drs_tojikobod', 'rg_drs', 'DRS-TOJIKOBOD', 'DISTRICT', 'Таджикабадский район', 'ноҳияи Тоҷикобод', 'Tojikobod district', 14),
  ('ds_drs_tursunzoda', 'rg_drs', 'DRS-TURSUNZODA', 'DISTRICT', 'Турсунзадевский район', 'ноҳияи Турсунзода', 'Tursunzoda district', 15),
  ('ds_drs_fayzobod', 'rg_drs', 'DRS-FAYZOBOD', 'DISTRICT', 'Файзабадский район', 'ноҳияи Файзобод', 'Fayzobod district', 16),
  ('ds_drs_shahrinav', 'rg_drs', 'DRS-SHAHRINAV', 'DISTRICT', 'Шахринавский район', 'ноҳияи Шаҳринав', 'Shahrinav district', 17);
