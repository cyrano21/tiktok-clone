-- Secure media routing and explicit content provenance.
ALTER TABLE "Video"
  ADD COLUMN "videoStorageKey" TEXT,
  ADD COLUMN "thumbnailStorageKey" TEXT,
  ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'ORKY_NATIVE',
  ADD COLUMN "externalPlatform" TEXT,
  ADD COLUMN "externalContentId" TEXT,
  ADD COLUMN "externalUrl" TEXT,
  ADD COLUMN "externalCreatorUsername" TEXT,
  ADD COLUMN "externalCreatorDisplayName" TEXT,
  ADD COLUMN "externalCreatorAvatarUrl" TEXT;

CREATE INDEX "Video_sourceType_idx" ON "Video"("sourceType");
CREATE UNIQUE INDEX "Video_externalPlatform_externalContentId_key"
  ON "Video"("externalPlatform", "externalContentId");

-- ORKY stores only Orchidy catalog identity. Price, stock, currency and checkout
-- remain authoritative in Orchidy and are revalidated during handoff.
CREATE TABLE "VideoProductMatch" (
  "id" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "orchidyCatalogItemId" TEXT NOT NULL,
  "variantKey" TEXT NOT NULL DEFAULT '',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoProductMatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VideoProductMatch_videoId_orchidyCatalogItemId_variantKey_key"
  ON "VideoProductMatch"("videoId", "orchidyCatalogItemId", "variantKey");
CREATE INDEX "VideoProductMatch_videoId_status_idx"
  ON "VideoProductMatch"("videoId", "status");
CREATE INDEX "VideoProductMatch_orchidyCatalogItemId_idx"
  ON "VideoProductMatch"("orchidyCatalogItemId");

ALTER TABLE "VideoProductMatch"
  ADD CONSTRAINT "VideoProductMatch_videoId_fkey"
  FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Database defaults must match the ORKY identity, not just Prisma's generated client.
ALTER TABLE "Branding" ALTER COLUMN "name" SET DEFAULT 'ORKY';
ALTER TABLE "Branding" ALTER COLUMN "logoUrl" SET DEFAULT '/logo_orky.png';
ALTER TABLE "Branding" ALTER COLUMN "primaryColor" SET DEFAULT '#7C3AED';
ALTER TABLE "Branding" ALTER COLUMN "accentColor" SET DEFAULT '#F72585';
ALTER TABLE "Branding" ALTER COLUMN "tagline" SET DEFAULT 'La vidéo qui vous ressemble';

-- Only migrate untouched legacy defaults. Customer/admin custom branding is preserved.
UPDATE "Branding"
SET
  "name" = CASE WHEN "name" = 'TikTok' THEN 'ORKY' ELSE "name" END,
  "logoUrl" = CASE WHEN "logoUrl" IS NULL OR "logoUrl" IN ('/logo.png', '/logo_tiktok.png') THEN '/logo_orky.png' ELSE "logoUrl" END,
  "primaryColor" = CASE WHEN "primaryColor" = '#FE2C55' THEN '#7C3AED' ELSE "primaryColor" END,
  "accentColor" = CASE WHEN "accentColor" = '#25F4EE' THEN '#F72585' ELSE "accentColor" END,
  "tagline" = CASE WHEN "tagline" = 'Short videos' THEN 'La vidéo qui vous ressemble' ELSE "tagline" END
WHERE "tenant" = 'default';
