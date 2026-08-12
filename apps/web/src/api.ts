import type { JSONContent } from "@tiptap/core";

export type ArchiveFilter = "active" | "archived" | "all";
export type EntryType = "NPC" | "LOCATION" | "JOURNAL";

export interface World {
  id: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign extends World {
  worldId: string;
}

export interface WorkspaceWindowDescriptor {
  entryId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zOrder: number;
  isMinimized: boolean;
}

export interface CampaignWorkspaceSnapshot {
  id: string;
  campaignId: string;
  backgroundMediaId: string | null;
  createdAt: string;
  updatedAt: string;
  windows: WorkspaceWindowDescriptor[];
}

export type MediaType = "IMAGE" | "MAP";

export interface Media {
  id: string;
  name: string;
  description: string | null;
  type: MediaType;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  scope: { kind: "world" | "campaign"; id: string };
  isArchived: boolean;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  urls: { display: string; thumbnail: string; original: string };
}

export interface MapMarker {
  id: string;
  mediaId: string;
  entryId: string;
  scope: { kind: "world" | "campaign"; id: string };
  x: number;
  y: number;
  label: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Entry {
  id: string;
  type: EntryType;
  title: string;
  document: JSONContent;
  documentVersion: number;
  scope: { kind: "world" | "campaign"; id: string };
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EntrySummary = Pick<
  Entry,
  "id" | "type" | "title" | "scope" | "isArchived"
>;

export interface EntryRelationship {
  id: string;
  sourceEntryId: string;
  targetEntryId: string;
  contextNote: string | null;
  source: EntrySummary;
  target: EntrySummary;
  createdAt: string;
  updatedAt: string;
}

export type EntryBacklink =
  | {
      kind: "relationship";
      relationship: EntryRelationship;
      source: EntrySummary;
    }
  | { kind: "inline"; source: EntrySummary };

export interface EntryKnowledge {
  outgoing: EntryRelationship[];
  backlinks: EntryBacklink[];
}

export interface Tag {
  id: string;
  worldId: string;
  name: string;
}

export interface SearchResult extends Entry {
  rank: number;
  tags: Tag[];
}

interface ListResponse<T> {
  items: T[];
}

interface ApiErrorResponse {
  error?: { message?: string };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = "The request could not be completed.";
    try {
      const body = (await response.json()) as ApiErrorResponse;
      message = body.error?.message ?? message;
    } catch {
      // Keep the safe fallback for a non-JSON failure.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

export function listWorlds(archive: ArchiveFilter) {
  return apiRequest<ListResponse<World>>(`/api/worlds?archive=${archive}`);
}

export function createWorld(input: { name: string; description?: string }) {
  return apiRequest<World>("/api/worlds", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateWorld(
  id: string,
  input: Partial<Pick<World, "name" | "description" | "isArchived">>,
) {
  return apiRequest<World>(`/api/worlds/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function getWorld(id: string) {
  return apiRequest<World>(`/api/worlds/${id}`);
}

export function listCampaigns(worldId: string, archive: ArchiveFilter) {
  return apiRequest<ListResponse<Campaign>>(
    `/api/worlds/${worldId}/campaigns?archive=${archive}`,
  );
}

export function createCampaign(
  worldId: string,
  input: { name: string; description?: string },
) {
  return apiRequest<Campaign>(`/api/worlds/${worldId}/campaigns`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCampaign(
  id: string,
  input: Partial<Pick<Campaign, "name" | "description" | "isArchived">>,
) {
  return apiRequest<Campaign>(`/api/campaigns/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function getCampaign(id: string) {
  return apiRequest<Campaign>(`/api/campaigns/${id}`);
}

export function getCampaignWorkspace(campaignId: string) {
  return apiRequest<CampaignWorkspaceSnapshot>(
    `/api/campaigns/${campaignId}/workspace`,
  );
}

export function replaceCampaignWorkspace(
  campaignId: string,
  windows: WorkspaceWindowDescriptor[],
) {
  return apiRequest<CampaignWorkspaceSnapshot>(
    `/api/campaigns/${campaignId}/workspace`,
    {
      method: "PUT",
      body: JSON.stringify({ windows }),
    },
  );
}

export function updateCampaignWorkspaceBackground(
  campaignId: string,
  mediaId: string | null,
) {
  return apiRequest<CampaignWorkspaceSnapshot>(
    `/api/campaigns/${campaignId}/workspace/background`,
    { method: "PATCH", body: JSON.stringify({ mediaId }) },
  );
}

function mediaQuery(archive: ArchiveFilter, type?: MediaType) {
  const query = new URLSearchParams({ archive });
  if (type) query.set("type", type);
  return query.toString();
}

export function listWorldMedia(
  worldId: string,
  archive: ArchiveFilter,
  type?: MediaType,
) {
  return apiRequest<ListResponse<Media>>(
    `/api/worlds/${worldId}/media?${mediaQuery(archive, type)}`,
  );
}

export function listCampaignMedia(
  campaignId: string,
  archive: ArchiveFilter,
  type?: MediaType,
) {
  return apiRequest<ListResponse<Media>>(
    `/api/campaigns/${campaignId}/media?${mediaQuery(archive, type)}`,
  );
}

function mediaForm(input: {
  name: string;
  description?: string;
  type: MediaType;
  file: File;
}) {
  const form = new FormData();
  form.set("name", input.name);
  if (input.description) form.set("description", input.description);
  form.set("type", input.type);
  form.set("file", input.file);
  return form;
}

export function importWorldMedia(
  worldId: string,
  input: { name: string; description?: string; type: MediaType; file: File },
) {
  return apiRequest<Media>(`/api/worlds/${worldId}/media`, {
    method: "POST",
    body: mediaForm(input),
  });
}

export function importCampaignMedia(
  campaignId: string,
  input: { name: string; description?: string; type: MediaType; file: File },
) {
  return apiRequest<Media>(`/api/campaigns/${campaignId}/media`, {
    method: "POST",
    body: mediaForm(input),
  });
}

export function updateMedia(
  mediaId: string,
  input: Partial<Pick<Media, "name" | "description" | "isArchived">>,
) {
  return apiRequest<Media>(`/api/media/${mediaId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteMedia(mediaId: string) {
  return apiRequest<void>(`/api/media/${mediaId}`, { method: "DELETE" });
}

export function listMapMarkers(campaignId: string, mediaId: string) {
  return apiRequest<ListResponse<MapMarker>>(
    `/api/campaigns/${campaignId}/media/${mediaId}/markers`,
  );
}

export function createMapMarker(
  campaignId: string,
  mediaId: string,
  input: {
    entryId: string;
    scope: "world" | "campaign";
    scopeId: string;
    x: number;
    y: number;
    label?: string | null;
  },
) {
  return apiRequest<MapMarker>(
    `/api/campaigns/${campaignId}/media/${mediaId}/markers`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function updateMapMarker(
  campaignId: string,
  mediaId: string,
  markerId: string,
  input: Partial<Pick<MapMarker, "entryId" | "x" | "y" | "label">>,
) {
  return apiRequest<MapMarker>(
    `/api/campaigns/${campaignId}/media/${mediaId}/markers/${markerId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function deleteMapMarker(
  campaignId: string,
  mediaId: string,
  markerId: string,
) {
  return apiRequest<void>(
    `/api/campaigns/${campaignId}/media/${mediaId}/markers/${markerId}`,
    { method: "DELETE" },
  );
}

export function listWorldEntries(
  worldId: string,
  archive: ArchiveFilter,
  type?: EntryType,
) {
  const typeQuery = type ? `&type=${type}` : "";
  return apiRequest<ListResponse<Entry>>(
    `/api/worlds/${worldId}/entries?archive=${archive}${typeQuery}`,
  );
}

export function listCampaignEntries(
  campaignId: string,
  archive: ArchiveFilter,
  type?: EntryType,
) {
  const typeQuery = type ? `&type=${type}` : "";
  return apiRequest<ListResponse<Entry>>(
    `/api/campaigns/${campaignId}/entries?archive=${archive}${typeQuery}`,
  );
}

export function createWorldEntry(
  worldId: string,
  input: { type: EntryType; title: string },
) {
  return apiRequest<Entry>(`/api/worlds/${worldId}/entries`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createCampaignEntry(
  campaignId: string,
  input: {
    type: EntryType;
    title: string;
    scope?: "campaign" | "world";
  },
) {
  return apiRequest<Entry>(`/api/campaigns/${campaignId}/entries`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateEntry(
  id: string,
  input: Partial<Pick<Entry, "title" | "document" | "isArchived">>,
) {
  return apiRequest<Entry>(`/api/entries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function getEntry(id: string) {
  return apiRequest<Entry>(`/api/entries/${id}`);
}

export function getEntryKnowledge(id: string) {
  return apiRequest<EntryKnowledge>(`/api/entries/${id}/knowledge`);
}

export function createEntryRelationship(
  sourceEntryId: string,
  input: { targetEntryId: string; contextNote?: string | null },
) {
  return apiRequest<EntryRelationship>(
    `/api/entries/${sourceEntryId}/relationships`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function deleteEntryRelationship(
  sourceEntryId: string,
  relationshipId: string,
) {
  return apiRequest<void>(
    `/api/entries/${sourceEntryId}/relationships/${relationshipId}`,
    { method: "DELETE" },
  );
}

export function listWorldTags(worldId: string, query = "") {
  const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
  return apiRequest<ListResponse<Tag>>(`/api/worlds/${worldId}/tags${suffix}`);
}

export function listEntryTags(entryId: string) {
  return apiRequest<ListResponse<Tag>>(`/api/entries/${entryId}/tags`);
}

export function replaceEntryTags(entryId: string, tags: string[]) {
  return apiRequest<ListResponse<Tag>>(`/api/entries/${entryId}/tags`, {
    method: "PUT",
    body: JSON.stringify({ tags }),
  });
}

export interface EntrySearchInput {
  query?: string;
  archive?: ArchiveFilter;
  type?: EntryType;
  tag?: string;
  limit?: number;
}

function searchQuery(input: EntrySearchInput) {
  const parameters = new URLSearchParams();
  if (input.query) parameters.set("q", input.query);
  if (input.archive) parameters.set("archive", input.archive);
  if (input.type) parameters.set("type", input.type);
  if (input.tag) parameters.set("tag", input.tag);
  if (input.limit) parameters.set("limit", String(input.limit));
  return parameters.toString();
}

export function searchWorldEntries(worldId: string, input: EntrySearchInput) {
  return apiRequest<ListResponse<SearchResult>>(
    `/api/worlds/${worldId}/search?${searchQuery(input)}`,
  );
}

export function searchCampaignEntries(
  campaignId: string,
  input: EntrySearchInput,
) {
  return apiRequest<ListResponse<SearchResult>>(
    `/api/campaigns/${campaignId}/search?${searchQuery(input)}`,
  );
}

export function searchAllEntries(input: EntrySearchInput) {
  return apiRequest<ListResponse<SearchResult>>(
    `/api/search?${searchQuery(input)}`,
  );
}
