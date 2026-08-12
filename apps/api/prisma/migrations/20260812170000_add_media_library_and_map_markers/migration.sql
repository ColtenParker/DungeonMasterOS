CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'MAP');

CREATE TABLE "Media" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(5000),
    "type" "MediaType" NOT NULL,
    "originalFilename" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "checksumSha256" CHAR(64) NOT NULL,
    "originalStorageKey" VARCHAR(500) NOT NULL,
    "displayStorageKey" VARCHAR(500) NOT NULL,
    "thumbnailStorageKey" VARCHAR(500) NOT NULL,
    "worldId" UUID,
    "campaignId" UUID,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Media_owner_check" CHECK (
        ("worldId" IS NOT NULL AND "campaignId" IS NULL) OR
        ("worldId" IS NULL AND "campaignId" IS NOT NULL)
    ),
    CONSTRAINT "Media_dimensions_check" CHECK (
        "byteSize" > 0 AND "width" > 0 AND "height" > 0
    )
);

ALTER TABLE "CampaignWorkspace" ADD COLUMN "backgroundMediaId" UUID;

CREATE TABLE "MapMarker" (
    "id" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "worldId" UUID,
    "campaignId" UUID,
    "x" DECIMAL(10,9) NOT NULL,
    "y" DECIMAL(10,9) NOT NULL,
    "label" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapMarker_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MapMarker_owner_check" CHECK (
        ("worldId" IS NOT NULL AND "campaignId" IS NULL) OR
        ("worldId" IS NULL AND "campaignId" IS NOT NULL)
    ),
    CONSTRAINT "MapMarker_coordinates_check" CHECK (
        "x" >= 0 AND "x" <= 1 AND "y" >= 0 AND "y" <= 1
    )
);

CREATE INDEX "Media_worldId_type_isArchived_idx" ON "Media"("worldId", "type", "isArchived");
CREATE INDEX "Media_campaignId_type_isArchived_idx" ON "Media"("campaignId", "type", "isArchived");
CREATE INDEX "Media_checksumSha256_idx" ON "Media"("checksumSha256");
CREATE INDEX "CampaignWorkspace_backgroundMediaId_idx" ON "CampaignWorkspace"("backgroundMediaId");
CREATE INDEX "MapMarker_mediaId_worldId_idx" ON "MapMarker"("mediaId", "worldId");
CREATE INDEX "MapMarker_mediaId_campaignId_idx" ON "MapMarker"("mediaId", "campaignId");
CREATE INDEX "MapMarker_entryId_idx" ON "MapMarker"("entryId");

ALTER TABLE "Media" ADD CONSTRAINT "Media_worldId_fkey"
FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Media" ADD CONSTRAINT "Media_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignWorkspace" ADD CONSTRAINT "CampaignWorkspace_backgroundMediaId_fkey"
FOREIGN KEY ("backgroundMediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MapMarker" ADD CONSTRAINT "MapMarker_mediaId_fkey"
FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MapMarker" ADD CONSTRAINT "MapMarker_entryId_fkey"
FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MapMarker" ADD CONSTRAINT "MapMarker_worldId_fkey"
FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MapMarker" ADD CONSTRAINT "MapMarker_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
