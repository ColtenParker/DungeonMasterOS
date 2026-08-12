import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Campaign, Media, World } from "./api.js";
import { MediaLibrary } from "./MediaLibrary.js";

const world: World = {
  id: "0198a5d0-3d4a-7000-8000-000000000001",
  name: "Eldoria",
  description: null,
  isArchived: false,
  createdAt: "2026-08-12T16:00:00.000Z",
  updatedAt: "2026-08-12T16:00:00.000Z",
};
const campaign: Campaign = {
  ...world,
  id: "0198a5d0-3d4a-7000-8000-000000000002",
  worldId: world.id,
  name: "Crown",
};
const map: Media = {
  id: "0198a5d0-3d4a-7000-8000-000000000003",
  name: "Old Keep",
  description: "Ruined walls",
  type: "MAP",
  originalFilename: "keep.png",
  mimeType: "image/png",
  byteSize: 1024,
  width: 1200,
  height: 800,
  scope: { kind: "world", id: world.id },
  isArchived: false,
  isAvailable: true,
  createdAt: world.createdAt,
  updatedAt: world.updatedAt,
  urls: {
    display: "/display",
    thumbnail: "/thumbnail",
    original: "/original",
  },
};

function response(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("MediaLibrary", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("browses inherited Campaign Media and edits its metadata", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        if (url === `/api/campaigns/${campaign.id}`) return response(campaign);
        if (url === `/api/worlds/${world.id}`) return response(world);
        if (url.startsWith(`/api/campaigns/${campaign.id}/media?`)) {
          return response({ items: [map] });
        }
        if (url === `/api/media/${map.id}` && init?.method === "PATCH") {
          const body = JSON.parse(
            typeof init.body === "string" ? init.body : "",
          ) as Partial<Media>;
          return response({ ...map, ...body });
        }
        return response({ items: [] });
      });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/campaigns/${campaign.id}/media`]}>
        <Routes>
          <Route
            path="/campaigns/:campaignId/media"
            element={<MediaLibrary />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: /Old Keep/ }));
    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Restored Keep");
    await user.click(screen.getByRole("button", { name: "Save Media" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/media/${map.id}`,
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
  });
});
