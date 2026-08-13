ALTER TYPE "EntryType" ADD VALUE 'QUEST';
ALTER TYPE "EntryType" ADD VALUE 'FACTION';
ALTER TYPE "EntryType" ADD VALUE 'ITEM';

CREATE TABLE "EntrySection" (
    "entryId" UUID NOT NULL,
    "key" VARCHAR(40) NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "EntrySection_pkey" PRIMARY KEY ("entryId", "key")
);
CREATE UNIQUE INDEX "EntrySection_entryId_position_key" ON "EntrySection"("entryId", "position");
ALTER TABLE "EntrySection" ADD CONSTRAINT "EntrySection_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NpcDetails" (
    "entryId" UUID NOT NULL,
    "portraitMediaId" UUID,
    "status" VARCHAR(80),
    "currentLocationId" UUID,
    CONSTRAINT "NpcDetails_pkey" PRIMARY KEY ("entryId")
);
CREATE INDEX "NpcDetails_portraitMediaId_idx" ON "NpcDetails"("portraitMediaId");
CREATE INDEX "NpcDetails_currentLocationId_idx" ON "NpcDetails"("currentLocationId");
CREATE INDEX "NpcDetails_status_idx" ON "NpcDetails"("status");
ALTER TABLE "NpcDetails" ADD CONSTRAINT "NpcDetails_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NpcDetails" ADD CONSTRAINT "NpcDetails_portraitMediaId_fkey" FOREIGN KEY ("portraitMediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NpcDetails" ADD CONSTRAINT "NpcDetails_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "LocationDetails" (
    "entryId" UUID NOT NULL,
    "parentLocationId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "LocationDetails_pkey" PRIMARY KEY ("entryId")
);
CREATE INDEX "LocationDetails_parentLocationId_sortOrder_idx" ON "LocationDetails"("parentLocationId", "sortOrder");
ALTER TABLE "LocationDetails" ADD CONSTRAINT "LocationDetails_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocationDetails" ADD CONSTRAINT "LocationDetails_parentLocationId_fkey" FOREIGN KEY ("parentLocationId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "QuestDetails" (
    "entryId" UUID NOT NULL,
    "status" VARCHAR(80),
    CONSTRAINT "QuestDetails_pkey" PRIMARY KEY ("entryId")
);
CREATE INDEX "QuestDetails_status_idx" ON "QuestDetails"("status");
ALTER TABLE "QuestDetails" ADD CONSTRAINT "QuestDetails_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QuestObjective" (
    "id" UUID NOT NULL,
    "questId" UUID NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    CONSTRAINT "QuestObjective_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuestObjective_questId_position_key" ON "QuestObjective"("questId", "position");
CREATE INDEX "QuestObjective_questId_idx" ON "QuestObjective"("questId");
ALTER TABLE "QuestObjective" ADD CONSTRAINT "QuestObjective_questId_fkey" FOREIGN KEY ("questId") REFERENCES "QuestDetails"("entryId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FactionDetails" (
    "entryId" UUID NOT NULL,
    "status" VARCHAR(80),
    CONSTRAINT "FactionDetails_pkey" PRIMARY KEY ("entryId")
);
CREATE INDEX "FactionDetails_status_idx" ON "FactionDetails"("status");
ALTER TABLE "FactionDetails" ADD CONSTRAINT "FactionDetails_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FactionLeader" (
    "id" UUID NOT NULL,
    "factionId" UUID NOT NULL,
    "npcId" UUID NOT NULL,
    "role" VARCHAR(120),
    "position" INTEGER NOT NULL,
    CONSTRAINT "FactionLeader_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FactionLeader_factionId_position_key" ON "FactionLeader"("factionId", "position");
CREATE INDEX "FactionLeader_npcId_idx" ON "FactionLeader"("npcId");
ALTER TABLE "FactionLeader" ADD CONSTRAINT "FactionLeader_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "FactionDetails"("entryId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FactionLeader" ADD CONSTRAINT "FactionLeader_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Inventory" (
    "id" UUID NOT NULL,
    "ownerEntryId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Inventory_ownerEntryId_position_key" ON "Inventory"("ownerEntryId", "position");
CREATE INDEX "Inventory_ownerEntryId_idx" ON "Inventory"("ownerEntryId");
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_ownerEntryId_fkey" FOREIGN KEY ("ownerEntryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InventoryLine" (
    "id" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" VARCHAR(500),
    "position" INTEGER NOT NULL,
    CONSTRAINT "InventoryLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InventoryLine_quantity_check" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "InventoryLine_inventoryId_position_key" ON "InventoryLine"("inventoryId", "position");
CREATE INDEX "InventoryLine_itemId_idx" ON "InventoryLine"("itemId");
ALTER TABLE "InventoryLine" ADD CONSTRAINT "InventoryLine_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryLine" ADD CONSTRAINT "InventoryLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
