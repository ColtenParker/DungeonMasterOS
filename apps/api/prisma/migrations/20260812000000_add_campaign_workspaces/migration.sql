CREATE TABLE "CampaignWorkspace" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceEntryWindow" (
    "workspaceId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "zOrder" INTEGER NOT NULL,
    "isMinimized" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WorkspaceEntryWindow_pkey" PRIMARY KEY ("workspaceId", "entryId"),
    CONSTRAINT "WorkspaceEntryWindow_geometry_check" CHECK (
        "x" >= 0 AND
        "y" >= 0 AND
        "width" >= 320 AND
        "height" >= 240 AND
        "zOrder" >= 0
    )
);

CREATE UNIQUE INDEX "CampaignWorkspace_campaignId_key"
ON "CampaignWorkspace"("campaignId");

CREATE INDEX "WorkspaceEntryWindow_entryId_idx"
ON "WorkspaceEntryWindow"("entryId");

ALTER TABLE "CampaignWorkspace" ADD CONSTRAINT "CampaignWorkspace_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkspaceEntryWindow" ADD CONSTRAINT "WorkspaceEntryWindow_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "CampaignWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkspaceEntryWindow" ADD CONSTRAINT "WorkspaceEntryWindow_entryId_fkey"
FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "CampaignWorkspace" ("id", "campaignId", "createdAt", "updatedAt")
SELECT "id", "id", "createdAt", "updatedAt"
FROM "Campaign";
