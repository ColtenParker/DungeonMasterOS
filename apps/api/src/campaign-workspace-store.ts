import type {
  CampaignWorkspace,
  Prisma,
  PrismaClient,
  WorkspaceEntryWindow,
} from "@prisma/client";

export const MIN_WINDOW_WIDTH = 320;
export const MIN_WINDOW_HEIGHT = 240;
export const MAX_WINDOW_GEOMETRY = 100_000;

export interface WorkspaceWindowRecord {
  entryId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zOrder: number;
  isMinimized: boolean;
}

export interface CampaignWorkspaceRecord {
  id: string;
  campaignId: string;
  backgroundMediaId: string | null;
  createdAt: Date;
  updatedAt: Date;
  windows: WorkspaceWindowRecord[];
}

export interface WorkspaceSnapshotInput {
  windows: WorkspaceWindowRecord[];
}

export class WorkspaceScopeValidationError extends Error {}
export class WorkspaceBackgroundValidationError extends Error {}

export interface CampaignWorkspaceStore {
  findWorkspace(campaignId: string): Promise<CampaignWorkspaceRecord | null>;
  replaceWorkspace(
    campaignId: string,
    input: WorkspaceSnapshotInput,
  ): Promise<CampaignWorkspaceRecord | null>;
  updateBackground(
    campaignId: string,
    mediaId: string | null,
  ): Promise<CampaignWorkspaceRecord | null>;
}

type WorkspaceWithWindows = CampaignWorkspace & {
  windows: WorkspaceEntryWindow[];
};

function toWorkspace(record: WorkspaceWithWindows): CampaignWorkspaceRecord {
  return {
    id: record.id,
    campaignId: record.campaignId,
    backgroundMediaId: record.backgroundMediaId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    windows: record.windows
      .map(({ entryId, x, y, width, height, zOrder, isMinimized }) => ({
        entryId,
        x,
        y,
        width,
        height,
        zOrder,
        isMinimized,
      }))
      .sort(
        (left, right) =>
          left.zOrder - right.zOrder ||
          left.entryId.localeCompare(right.entryId),
      ),
  };
}

async function readWorkspace(
  client: Prisma.TransactionClient | PrismaClient,
  campaignId: string,
) {
  return client.campaignWorkspace.findUnique({
    where: { campaignId },
    include: { windows: true },
  });
}

async function validateEntryScope(
  transaction: Prisma.TransactionClient,
  campaignId: string,
  entryIds: string[],
) {
  if (!entryIds.length) return;

  const campaign = await transaction.campaign.findUnique({
    where: { id: campaignId },
    select: { worldId: true },
  });
  if (!campaign) return;

  const entries = await transaction.entry.findMany({
    where: { id: { in: entryIds } },
    select: { id: true, worldId: true, campaignId: true },
  });
  if (
    entries.length !== entryIds.length ||
    entries.some(
      (entry) =>
        entry.campaignId !== campaignId && entry.worldId !== campaign.worldId,
    )
  ) {
    throw new WorkspaceScopeValidationError(
      "One or more Entry windows are outside the Campaign workspace scope.",
    );
  }
}

export function createPrismaCampaignWorkspaceStore(
  client: PrismaClient,
): CampaignWorkspaceStore {
  return {
    async findWorkspace(campaignId) {
      const workspace = await readWorkspace(client, campaignId);
      return workspace ? toWorkspace(workspace) : null;
    },

    async replaceWorkspace(campaignId, input) {
      return client.$transaction(async (transaction) => {
        const workspace = await transaction.campaignWorkspace.findUnique({
          where: { campaignId },
        });
        if (!workspace) return null;

        const entryIds = input.windows.map(({ entryId }) => entryId);
        if (new Set(entryIds).size !== entryIds.length) {
          throw new WorkspaceScopeValidationError(
            "An Entry can appear only once in a Campaign workspace.",
          );
        }
        await validateEntryScope(transaction, campaignId, entryIds);

        await transaction.workspaceEntryWindow.deleteMany({
          where: { workspaceId: workspace.id },
        });
        if (input.windows.length) {
          await transaction.workspaceEntryWindow.createMany({
            data: input.windows.map((window) => ({
              workspaceId: workspace.id,
              ...window,
            })),
          });
        }
        await transaction.campaignWorkspace.update({
          where: { id: workspace.id },
          data: { updatedAt: new Date() },
        });

        const updated = await readWorkspace(transaction, campaignId);
        if (!updated) {
          throw new Error("Campaign workspace disappeared during replacement.");
        }
        return toWorkspace(updated);
      });
    },

    async updateBackground(campaignId, mediaId) {
      return client.$transaction(async (transaction) => {
        const workspace = await transaction.campaignWorkspace.findUnique({
          where: { campaignId },
          include: { campaign: { select: { worldId: true } } },
        });
        if (!workspace) return null;

        if (mediaId) {
          const media = await transaction.media.findUnique({
            where: { id: mediaId },
            select: { worldId: true, campaignId: true },
          });
          if (
            !media ||
            (media.campaignId !== campaignId &&
              media.worldId !== workspace.campaign.worldId)
          ) {
            throw new WorkspaceBackgroundValidationError(
              "Background Media is outside the Campaign workspace scope.",
            );
          }
        }

        await transaction.campaignWorkspace.update({
          where: { id: workspace.id },
          data: { backgroundMediaId: mediaId },
        });
        const updated = await readWorkspace(transaction, campaignId);
        if (!updated) {
          throw new Error("Campaign workspace disappeared during update.");
        }
        return toWorkspace(updated);
      });
    },
  };
}
