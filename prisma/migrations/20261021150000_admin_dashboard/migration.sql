-- Phase 04: admin dashboard. Additive only: nothing is dropped, and existing
-- rows are backfilled, so this is safe on a database that already holds data.

-- A barber's own login (sees only their own appointments).
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BARBER';

-- Editable service categories replace the fixed enum.
CREATE TABLE "service_categories" (
    "id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- The three categories the enum had, with the labels the site showed for them.
INSERT INTO "service_categories" ("id", "name", "sortOrder", "updatedAt") VALUES
  ('haircut', '{"mn": "Үс засалт", "en": "Haircuts"}', 0, CURRENT_TIMESTAMP),
  ('beard', '{"mn": "Сахал ба хусалт", "en": "Beard & shave"}', 1, CURRENT_TIMESTAMP),
  ('ritual', '{"mn": "Багц үйлчилгээ", "en": "Combined services"}', 2, CURRENT_TIMESTAMP);

ALTER TABLE "services" ADD COLUMN "categoryId" TEXT;
UPDATE "services" SET "categoryId" = "category"::text;
ALTER TABLE "services" ALTER COLUMN "categoryId" SET NOT NULL;
-- The old enum column is no longer written; it stays (nullable) until a cleanup migration.
ALTER TABLE "services" ALTER COLUMN "category" DROP NOT NULL;

CREATE INDEX "services_categoryId_idx" ON "services"("categoryId");
ALTER TABLE "services" ADD CONSTRAINT "services_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Recent-activity feed on the overview.
CREATE INDEX "appointments_updatedAt_idx" ON "appointments"("updatedAt");

-- Editable website content (one row, "default").
CREATE TABLE "site_content" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "profile" JSONB NOT NULL DEFAULT '{}',
    "texts" JSONB NOT NULL DEFAULT '{}',
    "gallery" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_content_pkey" PRIMARY KEY ("id")
);

-- Hand-written constraints (see docs/BOOKING.md).
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_id_slug" CHECK ("id" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "site_content" ADD CONSTRAINT "site_content_single_row" CHECK ("id" = 'default');
