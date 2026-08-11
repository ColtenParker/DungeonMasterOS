export type ArchiveFilter = "active" | "archived" | "all";

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

interface ListResponse<T> {
  items: T[];
}

interface ApiErrorResponse {
  error?: { message?: string };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");

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
