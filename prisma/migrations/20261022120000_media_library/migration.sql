-- Phase 05: media library (stock and uploaded assets) and website media placements. Additive only.

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "MediaSource" AS ENUM ('PEXELS', 'PIXABAY', 'UPLOAD');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "source" "MediaSource" NOT NULL,
    "providerAssetId" TEXT,
    "sourceUrl" TEXT,
    "creatorName" TEXT,
    "creatorUrl" TEXT,
    "licenseName" TEXT NOT NULL,
    "licenseUrl" TEXT,
    "providerDescription" TEXT,
    "providerPreviewUrl" TEXT,
    "alt" JSONB NOT NULL DEFAULT '{"mn": "", "en": ""}',
    "notes" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" DOUBLE PRECISION,
    "posterFileName" TEXT,
    "status" "MediaStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_placements" (
    "id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "caption" JSONB,
    "options" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_placements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_fileName_key" ON "media_assets"("fileName");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_posterFileName_key" ON "media_assets"("posterFileName");

-- CreateIndex
CREATE INDEX "media_assets_status_kind_idx" ON "media_assets"("status", "kind");

-- CreateIndex
CREATE INDEX "media_assets_createdAt_idx" ON "media_assets"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_source_providerAssetId_key" ON "media_assets"("source", "providerAssetId");

-- CreateIndex
CREATE INDEX "media_placements_slot_position_idx" ON "media_placements"("slot", "position");

-- CreateIndex
CREATE INDEX "media_placements_ref_idx" ON "media_placements"("ref");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-written constraints.
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_provider_id" CHECK (("source" = 'UPLOAD') = ("providerAssetId" IS NULL));
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_bytes" CHECK ("bytes" > 0);
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_poster_video" CHECK ("posterFileName" IS NULL OR "kind" = 'VIDEO');
-- Every slot except the gallery holds at most one asset.
CREATE UNIQUE INDEX "media_placements_single_slot" ON "media_placements"("slot") WHERE "slot" <> 'gallery';
