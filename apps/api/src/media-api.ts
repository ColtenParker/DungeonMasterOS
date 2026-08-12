import { rm } from "node:fs/promises";

import { Router, type Request } from "express";
import multer from "multer";
import { z, ZodError } from "zod";

import {
  MAX_MEDIA_BYTES,
  MediaDeletionBlockedError,
  MediaNotFoundError,
  MediaScopeValidationError,
  type MediaContext,
  type MediaRecord,
  type MediaRepresentation,
  type MediaStore,
  MediaUnavailableError,
  MediaValidationError,
  type MapMarkerRecord,
} from "./media-store.js";

const uuidParams = z.object({ mediaId: z.uuid() });
const worldParams = z.object({ worldId: z.uuid() });
const campaignParams = z.object({ campaignId: z.uuid() });
const contextualMediaParams = z.object({
  worldId: z.uuid().optional(),
  campaignId: z.uuid().optional(),
  mediaId: z.uuid(),
  representation: z.enum(["original", "display", "thumbnail"]).optional(),
});
const markerParams = z.object({
  campaignId: z.uuid(),
  mediaId: z.uuid(),
  markerId: z.uuid().optional(),
});
const archiveQuery = z
  .object({
    archive: z.enum(["active", "archived", "all"]).default("active"),
    type: z.enum(["IMAGE", "MAP"]).optional(),
  })
  .strict();
const importFields = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(5000).optional(),
    type: z.enum(["IMAGE", "MAP"]),
  })
  .strict();
const updateFields = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    isArchived: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });
const markerFields = z
  .object({
    entryId: z.uuid(),
    scope: z.enum(["world", "campaign"]),
    scopeId: z.uuid(),
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    label: z.string().trim().max(120).nullable().optional(),
  })
  .strict();
const markerUpdateFields = z
  .object({
    entryId: z.uuid().optional(),
    x: z.number().finite().min(0).max(1).optional(),
    y: z.number().finite().min(0).max(1).optional(),
    label: z.string().trim().max(120).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

function validationError(error: ZodError) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "request";
    (fields[key] ??= []).push(issue.message);
  }
  return {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      fields,
    },
  };
}

function mediaUrl(context: MediaContext, mediaId: string, suffix = "") {
  const base =
    context.kind === "world"
      ? `/api/worlds/${context.worldId}/media/${mediaId}`
      : `/api/campaigns/${context.campaignId}/media/${mediaId}`;
  return `${base}${suffix}`;
}

function serializeMedia(context: MediaContext, record: MediaRecord) {
  return {
    ...record,
    checksumSha256: undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    urls: {
      display: mediaUrl(context, record.id, "/content/display"),
      thumbnail: mediaUrl(context, record.id, "/content/thumbnail"),
      original: mediaUrl(context, record.id, "/content/original"),
    },
  };
}

function serializeMarker(record: MapMarkerRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function contextFromRequest(request: Request): MediaContext {
  const params = contextualMediaParams.parse(request.params);
  return params.worldId
    ? { kind: "world", worldId: params.worldId }
    : { kind: "campaign", campaignId: params.campaignId! };
}

function owner(scope: "world" | "campaign", scopeId: string) {
  return scope === "world"
    ? ({ kind: "world", worldId: scopeId } as const)
    : ({ kind: "campaign", campaignId: scopeId } as const);
}

async function removeUploadedFile(request: Request) {
  if (request.file?.path) await rm(request.file.path, { force: true });
}

function sendDomainError(error: unknown, response: import("express").Response) {
  if (error instanceof ZodError) {
    response.status(400).json(validationError(error));
    return true;
  }
  if (error instanceof MediaValidationError) {
    response.status(422).json({
      error: { code: "INVALID_MEDIA", message: error.message },
    });
    return true;
  }
  if (error instanceof MediaScopeValidationError) {
    response.status(422).json({
      error: { code: "INVALID_MEDIA_SCOPE", message: error.message },
    });
    return true;
  }
  if (error instanceof MediaNotFoundError) {
    response.status(404).json({
      error: { code: "MEDIA_NOT_FOUND", message: error.message },
    });
    return true;
  }
  if (error instanceof MediaUnavailableError) {
    response.status(410).json({
      error: { code: "MEDIA_UNAVAILABLE", message: error.message },
    });
    return true;
  }
  if (error instanceof MediaDeletionBlockedError) {
    response.status(409).json({
      error: {
        code: "MEDIA_DELETE_BLOCKED",
        message: error.message,
        dependencies: error.dependencies,
      },
    });
    return true;
  }
  if (error instanceof multer.MulterError) {
    response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      error: {
        code:
          error.code === "LIMIT_FILE_SIZE"
            ? "MEDIA_TOO_LARGE"
            : "INVALID_UPLOAD",
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Image must be no larger than 50 MiB."
            : "The image upload is invalid.",
      },
    });
    return true;
  }
  return false;
}

export function createMediaRouter(store: MediaStore) {
  const router = Router();
  const upload = multer({
    dest: store.temporaryRoot,
    limits: { fileSize: MAX_MEDIA_BYTES, files: 1, fields: 3, parts: 4 },
  });

  router.get("/worlds/:worldId/media", async (request, response) => {
    try {
      const { worldId } = worldParams.parse(request.params);
      const query = archiveQuery.parse(request.query);
      const context = { kind: "world", worldId } as const;
      const items = await store.listMedia(context, query.archive, query.type);
      if (!items) {
        response.status(404).json({
          error: { code: "WORLD_NOT_FOUND", message: "World was not found." },
        });
        return;
      }
      response.json({
        items: items.map((item) => serializeMedia(context, item)),
      });
    } catch (error) {
      if (!sendDomainError(error, response)) throw error;
    }
  });

  router.get("/campaigns/:campaignId/media", async (request, response) => {
    try {
      const { campaignId } = campaignParams.parse(request.params);
      const query = archiveQuery.parse(request.query);
      const context = { kind: "campaign", campaignId } as const;
      const items = await store.listMedia(context, query.archive, query.type);
      if (!items) {
        response.status(404).json({
          error: {
            code: "CAMPAIGN_NOT_FOUND",
            message: "Campaign was not found.",
          },
        });
        return;
      }
      response.json({
        items: items.map((item) => serializeMedia(context, item)),
      });
    } catch (error) {
      if (!sendDomainError(error, response)) throw error;
    }
  });

  async function importFor(
    request: Request,
    response: import("express").Response,
    context: MediaContext,
  ) {
    try {
      if (!request.file)
        throw new MediaValidationError("An image file is required.");
      const input = importFields.parse(request.body);
      const record = await store.importMedia(context, {
        ...input,
        description: input.description || null,
        originalFilename: request.file.originalname,
        temporaryPath: request.file.path,
      });
      response.status(201).json(serializeMedia(context, record));
    } catch (error) {
      await removeUploadedFile(request);
      if (!sendDomainError(error, response)) throw error;
    }
  }

  router.post(
    "/worlds/:worldId/media",
    upload.single("file"),
    async (request, response) => {
      try {
        const { worldId } = worldParams.parse(request.params);
        await importFor(request, response, { kind: "world", worldId });
      } catch (error) {
        await removeUploadedFile(request);
        if (!sendDomainError(error, response)) throw error;
      }
    },
  );

  router.post(
    "/campaigns/:campaignId/media",
    upload.single("file"),
    async (request, response) => {
      try {
        const { campaignId } = campaignParams.parse(request.params);
        await importFor(request, response, { kind: "campaign", campaignId });
      } catch (error) {
        await removeUploadedFile(request);
        if (!sendDomainError(error, response)) throw error;
      }
    },
  );

  for (const prefix of ["/worlds/:worldId", "/campaigns/:campaignId"]) {
    router.get(`${prefix}/media/:mediaId`, async (request, response) => {
      try {
        const { mediaId } = contextualMediaParams.parse(request.params);
        const context = contextFromRequest(request);
        const record = await store.findMedia(context, mediaId);
        if (!record) {
          response.status(404).json({
            error: {
              code: "MEDIA_NOT_FOUND",
              message: "Media was not found.",
            },
          });
          return;
        }
        response.json(serializeMedia(context, record));
      } catch (error) {
        if (!sendDomainError(error, response)) throw error;
      }
    });

    router.get(
      `${prefix}/media/:mediaId/content/:representation`,
      async (request, response) => {
        try {
          const params = contextualMediaParams.parse(request.params);
          const context = contextFromRequest(request);
          const file = await store.getFile(
            context,
            params.mediaId,
            params.representation as MediaRepresentation,
          );
          if (!file) {
            response.status(404).json({
              error: {
                code: "MEDIA_NOT_FOUND",
                message: "Media was not found.",
              },
            });
            return;
          }
          response.set({
            "Content-Type": file.mimeType,
            "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, max-age=86400",
            ETag: file.etag,
          });
          if (request.headers["if-none-match"] === file.etag) {
            response.status(304).end();
            return;
          }
          response.sendFile(file.path);
        } catch (error) {
          if (!sendDomainError(error, response)) throw error;
        }
      },
    );
  }

  router.patch("/media/:mediaId", async (request, response) => {
    try {
      const { mediaId } = uuidParams.parse(request.params);
      const parsed = updateFields.parse(request.body);
      const input = {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.description !== undefined
          ? { description: parsed.description }
          : {}),
        ...(parsed.isArchived !== undefined
          ? { isArchived: parsed.isArchived }
          : {}),
      };
      const updated = await store.updateMedia(mediaId, input);
      if (!updated) {
        response.status(404).json({
          error: { code: "MEDIA_NOT_FOUND", message: "Media was not found." },
        });
        return;
      }
      const context =
        updated.scope.kind === "world"
          ? ({ kind: "world", worldId: updated.scope.id } as const)
          : ({ kind: "campaign", campaignId: updated.scope.id } as const);
      response.json(serializeMedia(context, updated));
    } catch (error) {
      if (!sendDomainError(error, response)) throw error;
    }
  });

  router.delete("/media/:mediaId", async (request, response) => {
    try {
      const { mediaId } = uuidParams.parse(request.params);
      if (!(await store.deleteMedia(mediaId))) {
        response.status(404).json({
          error: { code: "MEDIA_NOT_FOUND", message: "Media was not found." },
        });
        return;
      }
      response.status(204).end();
    } catch (error) {
      if (!sendDomainError(error, response)) throw error;
    }
  });

  router.get(
    "/campaigns/:campaignId/media/:mediaId/markers",
    async (request, response) => {
      try {
        const { campaignId, mediaId } = markerParams.parse(request.params);
        const markers = await store.listMarkers(campaignId, mediaId);
        if (!markers) {
          response.status(404).json({
            error: { code: "MAP_NOT_FOUND", message: "Map was not found." },
          });
          return;
        }
        response.json({ items: markers.map(serializeMarker) });
      } catch (error) {
        if (!sendDomainError(error, response)) throw error;
      }
    },
  );

  router.post(
    "/campaigns/:campaignId/media/:mediaId/markers",
    async (request, response) => {
      try {
        const { campaignId, mediaId } = markerParams.parse(request.params);
        const input = markerFields.parse(request.body);
        const marker = await store.createMarker(campaignId, mediaId, {
          entryId: input.entryId,
          owner: owner(input.scope, input.scopeId),
          x: input.x,
          y: input.y,
          ...(input.label !== undefined ? { label: input.label } : {}),
        });
        response.status(201).json(serializeMarker(marker));
      } catch (error) {
        if (!sendDomainError(error, response)) throw error;
      }
    },
  );

  router.patch(
    "/campaigns/:campaignId/media/:mediaId/markers/:markerId",
    async (request, response) => {
      try {
        const { campaignId, mediaId, markerId } = markerParams.parse(
          request.params,
        );
        const input = markerUpdateFields.parse(request.body);
        const marker = await store.updateMarker(
          campaignId,
          mediaId,
          markerId!,
          {
            ...(input.entryId !== undefined ? { entryId: input.entryId } : {}),
            ...(input.x !== undefined ? { x: input.x } : {}),
            ...(input.y !== undefined ? { y: input.y } : {}),
            ...(input.label !== undefined ? { label: input.label } : {}),
          },
        );
        if (!marker) {
          response.status(404).json({
            error: {
              code: "MARKER_NOT_FOUND",
              message: "Map marker was not found.",
            },
          });
          return;
        }
        response.json(serializeMarker(marker));
      } catch (error) {
        if (!sendDomainError(error, response)) throw error;
      }
    },
  );

  router.delete(
    "/campaigns/:campaignId/media/:mediaId/markers/:markerId",
    async (request, response) => {
      try {
        const { campaignId, mediaId, markerId } = markerParams.parse(
          request.params,
        );
        if (!(await store.deleteMarker(campaignId, mediaId, markerId!))) {
          response.status(404).json({
            error: {
              code: "MARKER_NOT_FOUND",
              message: "Map marker was not found.",
            },
          });
          return;
        }
        response.status(204).end();
      } catch (error) {
        if (!sendDomainError(error, response)) throw error;
      }
    },
  );

  router.use(
    (
      error: unknown,
      request: Request,
      response: import("express").Response,
      next: import("express").NextFunction,
    ) => {
      void removeUploadedFile(request).finally(() => {
        if (!sendDomainError(error, response)) next(error);
      });
    },
  );

  return router;
}
