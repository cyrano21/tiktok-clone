ALTER TABLE "Branding"
  ALTER COLUMN "name" SET DEFAULT 'ORKY',
  ALTER COLUMN "logoUrl" SET DEFAULT '/logo_orky.png',
  ALTER COLUMN "primaryColor" SET DEFAULT '#7C3AED',
  ALTER COLUMN "accentColor" SET DEFAULT '#F72585',
  ALTER COLUMN "tagline" SET DEFAULT 'La vidéo qui vous ressemble';

UPDATE "Branding"
SET
  "name" = 'ORKY',
  "logoUrl" = '/logo_orky.png',
  "primaryColor" = '#7C3AED',
  "accentColor" = '#F72585',
  "tagline" = 'La vidéo qui vous ressemble'
WHERE "tenant" = 'default'
  AND "name" = 'TikTok';
