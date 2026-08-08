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
