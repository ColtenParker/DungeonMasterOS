import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Entry, World } from "./api.js";
import { QuickOpen } from "./QuickOpen.js";

const world: World = {
  id: "0198a5d0-3d4a-7000-8000-000000000001",
  name: "Eldoria",
  description: null,
  isArchived: false,
  createdAt: "2026-08-11T23:00:00.000Z",
  updatedAt: "2026-08-11T23:00:00.000Z",
};
const entry: Entry = {
  id: "0198a5d0-3d4a-7000-8000-000000000003",
  type: "NPC",
  title: "Mira Vale",
  document: { type: "doc", content: [{ type: "paragraph" }] },
  documentVersion: 2,
  scope: { kind: "world", id: world.id },
  isArchived: false,
  createdAt: world.createdAt,
  updatedAt: world.updatedAt,
};

describe("Quick Open", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("opens from the keyboard, searches context, and selects a result", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ items: [{ ...entry, rank: 150, tags: [] }] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(
      <QuickOpen
        world={world}
        campaign={null}
        onOpen={onOpen}
        onError={vi.fn()}
      />,
    );

    await user.keyboard("{Control>}k{/Control}");
    expect(
      await screen.findByRole("dialog", { name: "Quick Open" }),
    ).toBeVisible();
    await user.type(screen.getByLabelText("Find an Entry"), "mira");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(await screen.findByRole("button", { name: /Mira Vale/ }));

    await waitFor(() =>
      expect(onOpen).toHaveBeenCalledWith(
        expect.objectContaining({ id: entry.id }),
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/worlds/${world.id}/search?q=mira&limit=50`,
      expect.anything(),
    );
  });
});
