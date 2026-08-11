CREATE TYPE "EntryType" AS ENUM ('NPC', 'LOCATION', 'JOURNAL');

CREATE TABLE "Entry" (
    "id" UUID NOT NULL,
    "type" "EntryType" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "document" JSONB NOT NULL,
    "documentVersion" INTEGER NOT NULL DEFAULT 1,
    "worldId" UUID,
    "campaignId" UUID,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Entry_exactly_one_scope_check" CHECK (
        (CASE WHEN "worldId" IS NULL THEN 0 ELSE 1 END) +
        (CASE WHEN "campaignId" IS NULL THEN 0 ELSE 1 END) = 1
    )
);

CREATE INDEX "Entry_worldId_type_isArchived_idx"
ON "Entry"("worldId", "type", "isArchived");

CREATE INDEX "Entry_campaignId_type_isArchived_idx"
ON "Entry"("campaignId", "type", "isArchived");

ALTER TABLE "Entry" ADD CONSTRAINT "Entry_worldId_fkey"
FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Entry" ADD CONSTRAINT "Entry_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
