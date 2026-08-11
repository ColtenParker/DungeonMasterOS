import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Campaign, Entry, World } from "./api.js";
import { EntryManager } from "./EntryManager.js";

const world: World = {
  id: "0198a5d0-3d4a-7000-8000-000000000001",
  name: "Eldoria",
  description: null,
  isArchived: false,
  createdAt: "2026-08-11T19:00:00.000Z",
  updatedAt: "2026-08-11T19:00:00.000Z",
};
const campaign: Campaign = {
  ...world,
  id: "0198a5d0-3d4a-7000-8000-000000000002",
  worldId: world.id,
  name: "The Broken Crown",
};
const entry: Entry = {
  id: "0198a5d0-3d4a-7000-8000-000000000003",
  type: "NPC",
  title: "Mira Vale",
  document: { type: "doc", content: [{ type: "paragraph" }] },
  documentVersion: 1,
  scope: { kind: "world", id: world.id },
  isArchived: false,
  createdAt: "2026-08-11T19:00:00.000Z",
  updatedAt: "2026-08-11T19:00:00.000Z",
};

function response(body: unknown, status = 200) {
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

function requestBody(init?: RequestInit) {
  return typeof init?.body === "string" ? init.body : "";
}

describe("EntryManager", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("lists inherited Entries and creates in Campaign scope by default", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input, init) => {
        if (init?.method === "POST") {
          return response(
            { ...entry, scope: { kind: "campaign", id: campaign.id } },
            201,
          );
        }
        return response({ items: [entry] });
      });
    const user = userEvent.setup();
    render(
      <EntryManager world={world} campaign={campaign} onError={vi.fn()} />,
    );

    expect(await screen.findByText("Mira Vale")).toBeVisible();
    expect(screen.getAllByText("World")).toHaveLength(2);
    await user.selectOptions(screen.getByLabelText("Entry type"), "JOURNAL");
    await user.type(screen.getByLabelText("New Entry title"), "Session zero");
    await user.click(screen.getByRole("button", { name: "Create Entry" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/campaigns/${campaign.id}/entries`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            type: "JOURNAL",
            title: "Session zero",
            scope: "campaign",
          }),
        }),
      ),
    );
  });

  it("filters by Entry category", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(await response({ items: [entry] }));
    const user = userEvent.setup();
    render(<EntryManager world={world} campaign={null} onError={vi.fn()} />);

    await screen.findByText("Mira Vale");
    await user.selectOptions(screen.getByLabelText("Category"), "NPC");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/worlds/${world.id}/entries?archive=active&type=NPC`,
        expect.anything(),
      ),
    );
  });

  it("opens, explicitly saves, and archives an Entry", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input, init) => {
        const path = requestPath(input);
        if (path === `/api/entries/${entry.id}` && init?.method === "PATCH") {
          const body = JSON.parse(requestBody(init)) as Partial<Entry>;
          return response({ ...entry, ...body });
        }
        return response({ items: [entry] });
      });
    const user = userEvent.setup();
    render(<EntryManager world={world} campaign={null} onError={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: /Mira Vale/ }));
    const title = await screen.findByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Mira Revised");
    await user.click(screen.getByRole("button", { name: "Save Entry" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/entries/${entry.id}`,
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const saveCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        requestPath(input) === `/api/entries/${entry.id}` &&
        init?.method === "PATCH" &&
        requestBody(init).includes("Mira Revised"),
    );
    expect(JSON.parse(requestBody(saveCall?.[1]))).toMatchObject({
      title: "Mira Revised",
      document: { type: "doc" },
    });

    await user.click(screen.getByRole("button", { name: "Archive Entry" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/entries/${entry.id}`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ isArchived: true }),
        }),
      ),
    );
  });
});
