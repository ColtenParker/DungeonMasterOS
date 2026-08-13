import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Entry } from "./api.js";
import { EntryKnowledgePanel } from "./EntryKnowledgePanel.js";

const worldId = "0198a5d0-3d4a-7000-8000-000000000001";
const entry: Entry = {
  id: "0198a5d0-3d4a-7000-8000-000000000003",
  type: "NPC",
  title: "Mira Vale",
  document: { type: "doc", content: [{ type: "paragraph" }] },
  documentVersion: 2,
  sections: [],
  specialization: {
    type: "NPC",
    portraitMediaId: null,
    status: null,
    currentLocationId: null,
    inventories: [],
  },
  scope: { kind: "world", id: worldId },
  isArchived: false,
  createdAt: "2026-08-11T23:00:00.000Z",
  updatedAt: "2026-08-11T23:00:00.000Z",
};
const target = {
  ...entry,
  id: "0198a5d0-3d4a-7000-8000-000000000004",
  title: "North Gate",
};

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function requestPath(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.toString() : input.url;
}

describe("EntryKnowledgePanel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows tags, relationships, and both backlink kinds", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const path = requestPath(input);
      if (path.endsWith("/knowledge")) {
        return json({
          outgoing: [
            {
              id: "0198a5d0-3d4a-7000-8000-000000000005",
              sourceEntryId: entry.id,
              targetEntryId: target.id,
              contextNote: "Keeps watch",
              source: entry,
              target,
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt,
            },
          ],
          backlinks: [
            { kind: "relationship", source: target, relationship: {} },
            { kind: "inline", source: { ...target, isArchived: true } },
          ],
        });
      }
      return json({
        items: [
          {
            id: "0198a5d0-3d4a-7000-8000-000000000006",
            worldId,
            name: "Villain",
          },
        ],
      });
    });
    const onOpenEntry = vi.fn();
    const user = userEvent.setup();
    render(
      <EntryKnowledgePanel
        entry={entry}
        worldId={worldId}
        onSearchEntries={vi.fn(() => Promise.resolve([target]))}
        onOpenEntry={onOpenEntry}
        onError={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("button", { name: "Remove Villain tag" }),
    ).toBeVisible();
    expect(screen.getByText("Keeps watch")).toBeVisible();
    expect(screen.getByText("Inline mention · Archived")).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "North Gate" })[0]!);
    expect(onOpenEntry).toHaveBeenCalled();
  });

  it("searches for and creates an explicit relationship", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input, init) => {
        const path = requestPath(input);
        if (init?.method === "POST") return json({}, 201);
        if (path.endsWith("/knowledge"))
          return json({ outgoing: [], backlinks: [] });
        return json({ items: [] });
      });
    const user = userEvent.setup();
    render(
      <EntryKnowledgePanel
        entry={entry}
        worldId={worldId}
        onSearchEntries={vi.fn(() => Promise.resolve([target]))}
        onOpenEntry={vi.fn()}
        onError={vi.fn()}
      />,
    );

    await user.type(await screen.findByLabelText("Find Entry"), "gate");
    await user.type(
      screen.getByLabelText("Context note (optional)"),
      "Guarded",
    );
    await user.click(screen.getByRole("button", { name: "Find" }));
    await user.click(
      await screen.findByRole("button", { name: "Add North Gate" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/entries/${entry.id}/relationships`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});
