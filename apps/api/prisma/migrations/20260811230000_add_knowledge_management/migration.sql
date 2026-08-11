ALTER TABLE "Entry"
ADD COLUMN "documentText" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Entry"
ADD COLUMN "searchVector" TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("documentText", '')), 'C')
) STORED;

CREATE INDEX "Entry_searchVector_idx" ON "Entry" USING GIN ("searchVector");

CREATE TABLE "EntryRelationship" (
    "id" UUID NOT NULL,
    "sourceEntryId" UUID NOT NULL,
    "targetEntryId" UUID NOT NULL,
    "contextNote" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntryRelationship_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EntryRelationship_no_self_check" CHECK ("sourceEntryId" <> "targetEntryId")
);

CREATE UNIQUE INDEX "EntryRelationship_sourceEntryId_targetEntryId_key"
ON "EntryRelationship"("sourceEntryId", "targetEntryId");

CREATE INDEX "EntryRelationship_targetEntryId_idx"
ON "EntryRelationship"("targetEntryId");

ALTER TABLE "EntryRelationship" ADD CONSTRAINT "EntryRelationship_sourceEntryId_fkey"
FOREIGN KEY ("sourceEntryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EntryRelationship" ADD CONSTRAINT "EntryRelationship_targetEntryId_fkey"
FOREIGN KEY ("targetEntryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "EntryInlineReference" (
    "sourceEntryId" UUID NOT NULL,
    "targetEntryId" UUID NOT NULL,

    CONSTRAINT "EntryInlineReference_pkey" PRIMARY KEY ("sourceEntryId", "targetEntryId"),
    CONSTRAINT "EntryInlineReference_no_self_check" CHECK ("sourceEntryId" <> "targetEntryId")
);

CREATE INDEX "EntryInlineReference_targetEntryId_idx"
ON "EntryInlineReference"("targetEntryId");

ALTER TABLE "EntryInlineReference" ADD CONSTRAINT "EntryInlineReference_sourceEntryId_fkey"
FOREIGN KEY ("sourceEntryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EntryInlineReference" ADD CONSTRAINT "EntryInlineReference_targetEntryId_fkey"
FOREIGN KEY ("targetEntryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Tag" (
    "id" UUID NOT NULL,
    "worldId" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "normalizedName" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tag_worldId_normalizedName_key"
ON "Tag"("worldId", "normalizedName");

CREATE INDEX "Tag_worldId_name_idx" ON "Tag"("worldId", "name");

ALTER TABLE "Tag" ADD CONSTRAINT "Tag_worldId_fkey"
FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "EntryTag" (
    "entryId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "EntryTag_pkey" PRIMARY KEY ("entryId", "tagId")
);

CREATE INDEX "EntryTag_tagId_idx" ON "EntryTag"("tagId");

ALTER TABLE "EntryTag" ADD CONSTRAINT "EntryTag_entryId_fkey"
FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EntryTag" ADD CONSTRAINT "EntryTag_tagId_fkey"
FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

