-- Snapshot the contact details submitted with each booking. Existing rows are
-- backfilled from their customer, so this is safe on a database with data.
ALTER TABLE "appointments" ADD COLUMN "customerEmail" TEXT,
ADD COLUMN "customerName" TEXT;

UPDATE "appointments" AS a
SET "customerName" = c."name", "customerEmail" = c."email"
FROM "customers" AS c
WHERE c."id" = a."customerId";

ALTER TABLE "appointments" ALTER COLUMN "customerName" SET NOT NULL;
