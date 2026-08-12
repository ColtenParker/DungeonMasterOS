import { createHash, randomBytes } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type {
  MapMarker,
  Media,
  MediaType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { fileTypeFromFile } from "file-type";
import sharp, { type Metadata } from "sharp";

export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
export const MAX_MEDIA_PIXELS = 100_000_000;
export const DISPLAY_MAX_DIMENSION = 4096;
export const THUMBNAIL_MAX_DIMENSION = 400;

export type MediaArchiveFilter = "active" | "archived" | "all";
export type MediaContext =
  { kind: "world"; worldId: string } | { kind: "campaign"; campaignId: string };
export type MediaOwner = MediaContext;
export type MediaRepresentation = "original" | "display" | "thumbnail";

export interface MediaRecord {
  id: string;
  name: string;
  description: string | null;
  type: MediaType;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  checksumSha256: string;
  scope: { kind: "world" | "campaign"; id: string };
  isArchived: boolean;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaImportInput {
  name: string;
  description?: string | null;
  type: MediaType;
  originalFilename: string;
  temporaryPath: string;
}

export interface MediaUpdateInput {
  name?: string;
  description?: string | null;
  isArchived?: boolean;
}

export interface MapMarkerRecord {
  id: string;
  mediaId: string;
  entryId: string;
  scope: { kind: "world" | "campaign"; id: string };
  x: number;
  y: number;
  label: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MapMarkerInput {
  entryId: string;
  owner: MediaOwner;
  x: number;
  y: number;
  label?: string | null;
}

export interface MediaDeletionDependency {
  kind: "workspace-background" | "map-marker";
  id: string;
  label: string;
}

export class MediaValidationError extends Error {}
export class MediaScopeValidationError extends Error {}
export class MediaNotFoundError extends Error {}
export class MediaUnavailableError extends Error {}
export class MediaDeletionBlockedError extends Error {
  constructor(public readonly dependencies: MediaDeletionDependency[]) {
    super("Media cannot be deleted while references depend on it.");
  }
}

export interface MediaFileResponse {
  path: string;
  mimeType: string;
  filename: string;
  etag: string;
}

export interface MediaStore {
  temporaryRoot: string;
  listMedia(
    context: MediaContext,
    archive: MediaArchiveFilter,
    type?: MediaType,
  ): Promise<MediaRecord[] | null>;
  findMedia(
    context: MediaContext,
    mediaId: string,
  ): Promise<MediaRecord | null>;
  importMedia(owner: MediaOwner, input: MediaImportInput): Promise<MediaRecord>;
  updateMedia(
    mediaId: string,
    input: MediaUpdateInput,
  ): Promise<MediaRecord | null>;
  deleteMedia(mediaId: string): Promise<boolean>;
  getFile(
    context: MediaContext,
    mediaId: string,
    representation: MediaRepresentation,
  ): Promise<MediaFileResponse | null>;
  listMarkers(
    campaignId: string,
    mediaId: string,
  ): Promise<MapMarkerRecord[] | null>;
  createMarker(
    campaignId: string,
    mediaId: string,
    input: MapMarkerInput,
  ): Promise<MapMarkerRecord>;
  updateMarker(
    campaignId: string,
    mediaId: string,
    markerId: string,
    input: Partial<Omit<MapMarkerInput, "owner">>,
  ): Promise<MapMarkerRecord | null>;
  deleteMarker(
    campaignId: string,
    mediaId: string,
    markerId: string,
  ): Promise<boolean>;
}

const acceptedTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

function uuidV7() {
  const bytes = randomBytes(16);
  const timestamp = BigInt(Date.now());
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp >> BigInt((5 - index) * 8)) & 0xff;
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function safeFilename(filename: string) {
  const normalized = [...path.basename(filename)]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("");
  return normalized.slice(0, 255) || "image";
}

function ownerData(owner: MediaOwner) {
  return owner.kind === "world"
    ? { worldId: owner.worldId, campaignId: null }
    : { worldId: null, campaignId: owner.campaignId };
}

function mediaScope(media: Pick<Media, "worldId" | "campaignId">) {
  return media.worldId
    ? ({ kind: "world", id: media.worldId } as const)
    : ({ kind: "campaign", id: media.campaignId! } as const);
}

function markerScope(marker: Pick<MapMarker, "worldId" | "campaignId">) {
  return marker.worldId
    ? ({ kind: "world", id: marker.worldId } as const)
    : ({ kind: "campaign", id: marker.campaignId! } as const);
}

function toMarker(marker: MapMarker): MapMarkerRecord {
  return {
    id: marker.id,
    mediaId: marker.mediaId,
    entryId: marker.entryId,
    scope: markerScope(marker),
    x: Number(marker.x),
    y: Number(marker.y),
    label: marker.label,
    createdAt: marker.createdAt,
    updatedAt: marker.updatedAt,
  };
}

function archiveWhere(archive: MediaArchiveFilter) {
  if (archive === "active") return { isArchived: false };
  if (archive === "archived") return { isArchived: true };
  return {};
}

function withinRoot(root: string, storageKey: string) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, storageKey);
  if (
    resolved !== resolvedRoot &&
    !resolved.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    throw new Error("Media storage key escaped the configured root.");
  }
  return resolved;
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function available(root: string, media: Media) {
  return (
    (await exists(withinRoot(root, media.originalStorageKey))) &&
    (await exists(withinRoot(root, media.displayStorageKey))) &&
    (await exists(withinRoot(root, media.thumbnailStorageKey)))
  );
}

async function toMedia(root: string, media: Media): Promise<MediaRecord> {
  return {
    id: media.id,
    name: media.name,
    description: media.description,
    type: media.type,
    originalFilename: media.originalFilename,
    mimeType: media.mimeType,
    byteSize: media.byteSize,
    width: media.width,
    height: media.height,
    checksumSha256: media.checksumSha256,
    scope: mediaScope(media),
    isArchived: media.isArchived,
    isAvailable: await available(root, media),
    createdAt: media.createdAt,
    updatedAt: media.updatedAt,
  };
}

async function campaignWorldId(
  client: Prisma.TransactionClient | PrismaClient,
  campaignId: string,
) {
  return (
    await client.campaign.findUnique({
      where: { id: campaignId },
      select: { worldId: true },
    })
  )?.worldId;
}

async function visibilityWhere(
  client: Prisma.TransactionClient | PrismaClient,
  context: MediaContext,
): Promise<Prisma.MediaWhereInput | null> {
  if (context.kind === "world") {
    const world = await client.world.findUnique({
      where: { id: context.worldId },
      select: { id: true },
    });
    return world ? { worldId: context.worldId } : null;
  }
  const worldId = await campaignWorldId(client, context.campaignId);
  return worldId
    ? { OR: [{ campaignId: context.campaignId }, { worldId }] }
    : null;
}

async function visibleMedia(
  client: Prisma.TransactionClient | PrismaClient,
  context: MediaContext,
  mediaId: string,
) {
  const visibility = await visibilityWhere(client, context);
  if (!visibility) return null;
  return client.media.findFirst({ where: { id: mediaId, AND: [visibility] } });
}

async function validateOwner(
  client: Prisma.TransactionClient | PrismaClient,
  owner: MediaOwner,
) {
  if (owner.kind === "world") {
    return Boolean(
      await client.world.findUnique({
        where: { id: owner.worldId },
        select: { id: true },
      }),
    );
  }
  return Boolean(
    await client.campaign.findUnique({
      where: { id: owner.campaignId },
      select: { id: true },
    }),
  );
}

async function validateMarkerScope(
  client: Prisma.TransactionClient,
  campaignId: string,
  media: Media,
  input: MapMarkerInput,
) {
  const worldId = await campaignWorldId(client, campaignId);
  if (!worldId) throw new MediaNotFoundError("Campaign was not found.");
  if (media.type !== "MAP") {
    throw new MediaScopeValidationError("Markers can be added only to maps.");
  }
  if (media.campaignId && media.campaignId !== campaignId) {
    throw new MediaScopeValidationError("Map is outside the Campaign scope.");
  }
  if (media.worldId && media.worldId !== worldId) {
    throw new MediaScopeValidationError("Map is outside the Campaign's World.");
  }

  const entry = await client.entry.findUnique({
    where: { id: input.entryId },
    select: { worldId: true, campaignId: true },
  });
  if (!entry)
    throw new MediaScopeValidationError("Marker target was not found.");

  if (input.owner.kind === "world") {
    if (
      input.owner.worldId !== worldId ||
      media.worldId !== worldId ||
      entry.worldId !== worldId
    ) {
      throw new MediaScopeValidationError(
        "World markers require a World map and a target in the same World.",
      );
    }
  } else if (
    input.owner.campaignId !== campaignId ||
    (entry.campaignId !== campaignId && entry.worldId !== worldId)
  ) {
    throw new MediaScopeValidationError(
      "Campaign markers can target only Campaign or inherited World Entries.",
    );
  }
}

export function createPrismaMediaStore(
  client: PrismaClient,
  configuredRoot = process.env.MEDIA_ROOT ?? path.resolve(".data", "media"),
): MediaStore {
  const root = path.resolve(configuredRoot);
  const temporaryRoot = path.join(root, ".uploads");

  return {
    temporaryRoot,

    async listMedia(context, archive, type) {
      const visibility = await visibilityWhere(client, context);
      if (!visibility) return null;
      const records = await client.media.findMany({
        where: {
          AND: [visibility, archiveWhere(archive), ...(type ? [{ type }] : [])],
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      return Promise.all(records.map((record) => toMedia(root, record)));
    },

    async findMedia(context, mediaId) {
      const record = await visibleMedia(client, context, mediaId);
      return record ? toMedia(root, record) : null;
    },

    async importMedia(owner, input) {
      if (!(await validateOwner(client, owner))) {
        throw new MediaNotFoundError("Media owner was not found.");
      }
      const sourceStat = await stat(input.temporaryPath);
      if (sourceStat.size <= 0 || sourceStat.size > MAX_MEDIA_BYTES) {
        throw new MediaValidationError("Image must be no larger than 50 MiB.");
      }
      const detected = await fileTypeFromFile(input.temporaryPath);
      const extension = detected ? acceptedTypes.get(detected.mime) : undefined;
      if (!detected || !extension) {
        throw new MediaValidationError(
          "Only PNG, JPEG, and WebP images are supported.",
        );
      }

      let metadata: Metadata;
      try {
        metadata = await sharp(input.temporaryPath, {
          animated: true,
          limitInputPixels: MAX_MEDIA_PIXELS,
        }).metadata();
      } catch {
        throw new MediaValidationError(
          "The image is malformed or exceeds the pixel limit.",
        );
      }
      if (!metadata.width || !metadata.height) {
        throw new MediaValidationError(
          "The image dimensions could not be read.",
        );
      }
      if (metadata.width * metadata.height > MAX_MEDIA_PIXELS) {
        throw new MediaValidationError(
          "Image must be no larger than 100 megapixels.",
        );
      }
      if ((metadata.pages ?? 1) > 1) {
        throw new MediaValidationError(
          "Animated and multi-page images are not supported.",
        );
      }

      const id = uuidV7();
      const relativeDirectory = id;
      const originalStorageKey = path.posix.join(
        relativeDirectory,
        `original.${extension}`,
      );
      const displayStorageKey = path.posix.join(
        relativeDirectory,
        "display.webp",
      );
      const thumbnailStorageKey = path.posix.join(
        relativeDirectory,
        "thumbnail.webp",
      );
      const stagingDirectory = path.join(temporaryRoot, `${id}-staging`);
      const finalDirectory = withinRoot(root, relativeDirectory);
      await mkdir(stagingDirectory, { recursive: true });

      try {
        const originalBytes = await readFile(input.temporaryPath);
        const checksumSha256 = createHash("sha256")
          .update(originalBytes)
          .digest("hex");
        try {
          await writeFile(
            path.join(stagingDirectory, `original.${extension}`),
            originalBytes,
          );
          await sharp(input.temporaryPath, {
            limitInputPixels: MAX_MEDIA_PIXELS,
          })
            .rotate()
            .resize({
              width: DISPLAY_MAX_DIMENSION,
              height: DISPLAY_MAX_DIMENSION,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 88 })
            .toFile(path.join(stagingDirectory, "display.webp"));
          await sharp(input.temporaryPath, {
            limitInputPixels: MAX_MEDIA_PIXELS,
          })
            .rotate()
            .resize({
              width: THUMBNAIL_MAX_DIMENSION,
              height: THUMBNAIL_MAX_DIMENSION,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 80 })
            .toFile(path.join(stagingDirectory, "thumbnail.webp"));
        } catch {
          throw new MediaValidationError(
            "The image could not be fully decoded and normalized.",
          );
        }

        const record = await client.media.create({
          data: {
            id,
            name: input.name,
            description: input.description ?? null,
            type: input.type,
            originalFilename: safeFilename(input.originalFilename),
            mimeType: detected.mime,
            byteSize: sourceStat.size,
            width: metadata.autoOrient.width,
            height: metadata.autoOrient.height,
            checksumSha256,
            originalStorageKey,
            displayStorageKey,
            thumbnailStorageKey,
            ...ownerData(owner),
          },
        });
        await mkdir(root, { recursive: true });
        try {
          await rename(stagingDirectory, finalDirectory);
        } catch (error) {
          await client.media.delete({ where: { id } });
          throw error;
        }
        return toMedia(root, record);
      } finally {
        await rm(stagingDirectory, { recursive: true, force: true });
        await rm(input.temporaryPath, { force: true });
      }
    },

    async updateMedia(mediaId, input) {
      const exists = await client.media.findUnique({ where: { id: mediaId } });
      if (!exists) return null;
      const updated = await client.media.update({
        where: { id: mediaId },
        data: input,
      });
      return toMedia(root, updated);
    },

    async deleteMedia(mediaId) {
      const media = await client.media.findUnique({ where: { id: mediaId } });
      if (!media) return false;
      const [backgrounds, markers] = await Promise.all([
        client.campaignWorkspace.findMany({
          where: { backgroundMediaId: mediaId },
          select: { id: true, campaign: { select: { name: true } } },
        }),
        client.mapMarker.findMany({
          where: { mediaId },
          select: { id: true, label: true },
        }),
      ]);
      const dependencies: MediaDeletionDependency[] = [
        ...backgrounds.map((background) => ({
          kind: "workspace-background" as const,
          id: background.id,
          label: background.campaign.name,
        })),
        ...markers.map((marker) => ({
          kind: "map-marker" as const,
          id: marker.id,
          label: marker.label ?? "Map marker",
        })),
      ];
      if (dependencies.length)
        throw new MediaDeletionBlockedError(dependencies);

      const directory = withinRoot(root, media.id);
      const trashDirectory = withinRoot(root, path.join(".trash", media.id));
      const hadDirectory = await exists(directory);
      if (hadDirectory) {
        await mkdir(path.dirname(trashDirectory), { recursive: true });
        await rm(trashDirectory, { recursive: true, force: true });
        await rename(directory, trashDirectory);
      }
      try {
        await client.media.delete({ where: { id: mediaId } });
      } catch (error) {
        if (hadDirectory) await rename(trashDirectory, directory);
        throw error;
      }
      await rm(trashDirectory, { recursive: true, force: true });
      return true;
    },

    async getFile(context, mediaId, representation) {
      const media = await visibleMedia(client, context, mediaId);
      if (!media) return null;
      const storageKey =
        representation === "original"
          ? media.originalStorageKey
          : representation === "display"
            ? media.displayStorageKey
            : media.thumbnailStorageKey;
      const filePath = withinRoot(root, storageKey);
      if (!(await exists(filePath))) {
        throw new MediaUnavailableError(
          "The managed media file is unavailable.",
        );
      }
      return {
        path: filePath,
        mimeType: representation === "original" ? media.mimeType : "image/webp",
        filename:
          representation === "original"
            ? media.originalFilename
            : `${media.name}.webp`,
        etag: `"${media.checksumSha256}-${representation}"`,
      };
    },

    async listMarkers(campaignId, mediaId) {
      const worldId = await campaignWorldId(client, campaignId);
      if (!worldId) return null;
      const media = await visibleMedia(
        client,
        { kind: "campaign", campaignId },
        mediaId,
      );
      if (!media || media.type !== "MAP") return null;
      const records = await client.mapMarker.findMany({
        where: {
          mediaId,
          OR: [{ campaignId }, ...(media.worldId ? [{ worldId }] : [])],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return records.map(toMarker);
    },

    async createMarker(campaignId, mediaId, input) {
      return client.$transaction(async (transaction) => {
        const media = await transaction.media.findUnique({
          where: { id: mediaId },
        });
        if (!media) throw new MediaNotFoundError("Map was not found.");
        await validateMarkerScope(transaction, campaignId, media, input);
        return toMarker(
          await transaction.mapMarker.create({
            data: {
              id: uuidV7(),
              mediaId,
              entryId: input.entryId,
              x: input.x,
              y: input.y,
              label: input.label ?? null,
              ...ownerData(input.owner),
            },
          }),
        );
      });
    },

    async updateMarker(campaignId, mediaId, markerId, input) {
      return client.$transaction(async (transaction) => {
        const marker = await transaction.mapMarker.findFirst({
          where: { id: markerId, mediaId },
        });
        if (!marker) return null;
        const media = await transaction.media.findUnique({
          where: { id: mediaId },
        });
        if (!media) return null;
        const owner = marker.worldId
          ? ({ kind: "world", worldId: marker.worldId } as const)
          : ({ kind: "campaign", campaignId: marker.campaignId! } as const);
        await validateMarkerScope(transaction, campaignId, media, {
          entryId: input.entryId ?? marker.entryId,
          x: input.x ?? Number(marker.x),
          y: input.y ?? Number(marker.y),
          label: input.label === undefined ? marker.label : input.label,
          owner,
        });
        return toMarker(
          await transaction.mapMarker.update({
            where: { id: markerId },
            data: input,
          }),
        );
      });
    },

    async deleteMarker(campaignId, mediaId, markerId) {
      const worldId = await campaignWorldId(client, campaignId);
      if (!worldId) return false;
      const marker = await client.mapMarker.findFirst({
        where: {
          id: markerId,
          mediaId,
          OR: [{ campaignId }, { worldId }],
        },
      });
      if (!marker) return false;
      await client.mapMarker.delete({ where: { id: markerId } });
      return true;
    },
  };
}
