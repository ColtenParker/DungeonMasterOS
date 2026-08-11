import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CampaignWorkspace } from "./CampaignWorkspace.js";
import type {
  Campaign,
  CampaignWorkspaceSnapshot,
  Entry,
  World,
} from "./api.js";

const world: World = {
  id: "0198a5d0-3d4a-7000-8000-000000000001",
  name: "Eldoria",
  description: null,
  isArchived: false,
  createdAt: "2026-08-11T23:00:00.000Z",
  updatedAt: "2026-08-11T23:00:00.000Z",
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
  createdAt: world.createdAt,
  updatedAt: world.updatedAt,
};
const workspace: CampaignWorkspaceSnapshot = {
  id: "0198a5d0-3d4a-7000-8000-000000000004",
  campaignId: campaign.id,
  createdAt: world.createdAt,
  updatedAt: world.updatedAt,
  windows: [
    {
      entryId: entry.id,
      x: 24,
      y: 24,
      width: 680,
      height: 600,
      zOrder: 1,
      isMinimized: false,
    },
  ],
};

function response(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function pathOf(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.toString() : input.url;
}

function mockWorkspaceApi() {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const path = pathOf(input);
    if (path === `/api/campaigns/${campaign.id}`) return response(campaign);
    if (path === `/api/worlds/${world.id}`) return response(world);
    if (path === `/api/campaigns/${campaign.id}/workspace`) {
      if (init?.method === "PUT") {
        const body = JSON.parse(
          typeof init.body === "string" ? init.body : "",
        ) as {
          windows: CampaignWorkspaceSnapshot["windows"];
        };
        return response({ ...workspace, windows: body.windows });
      }
      return response(workspace);
    }
    if (path === `/api/entries/${entry.id}` && init?.method === "PATCH") {
      const body = JSON.parse(
        typeof init.body === "string" ? init.body : "",
      ) as Partial<Entry>;
      return response({ ...entry, ...body });
    }
    if (path === `/api/entries/${entry.id}`) return response(entry);
    if (path.endsWith("/knowledge")) {
      return response({ outgoing: [], backlinks: [] });
    }
    if (path.includes("/tags")) return response({ items: [] });
    if (path.includes("/entries")) return response({ items: [entry] });
    return response({ error: { message: `Unhandled request: ${path}` } }, 500);
  });
}

function renderWorkspace() {
  return render(
    <MemoryRouter
      initialEntries={[`/campaigns/${campaign.id}/workspace`]}
      initialIndex={0}
    >
      <Routes>
        <Route
          path="/campaigns/:campaignId/workspace"
          element={<CampaignWorkspace />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CampaignWorkspace", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("restores, minimizes, restores, and duplicate-focuses one Entry window", async () => {
    const fetchMock = mockWorkspaceApi();
    const user = userEvent.setup();
    renderWorkspace();

    const window = await screen.findByRole("dialog", { name: "Mira Vale" });
    expect(window).toBeVisible();
    await user.click(
      within(window).getByRole("button", { name: "Minimize Mira Vale" }),
    );
    expect(window).not.toBeVisible();

    await user.click(screen.getByRole("button", { name: "Restore Mira Vale" }));
    expect(window).toBeVisible();

    const browser = screen.getByRole("complementary", {
      name: "Campaign Entry browser",
    });
    await user.click(
      within(browser).getByRole("button", { name: /Mira Vale/ }),
    );
    expect(screen.getAllByRole("dialog", { name: "Mira Vale" })).toHaveLength(
      1,
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/campaigns/${campaign.id}/workspace`,
        expect.objectContaining({ method: "PUT" }),
      ),
    );
  });

  it("protects a dirty Entry with Save, Discard, and Cancel choices", async () => {
    const fetchMock = mockWorkspaceApi();
    const user = userEvent.setup();
    renderWorkspace();

    const window = await screen.findByRole("dialog", { name: "Mira Vale" });
    const title = within(window).getByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Mira Revised");
    await user.click(
      within(window).getByRole("button", { name: "Archive Entry" }),
    );
    await waitFor(() => expect(title).toHaveValue("Mira Revised"));
    await user.click(
      within(window).getByRole("button", { name: "Close Mira Vale" }),
    );

    const confirmation = screen.getByRole("alertdialog", {
      name: "Save changes before closing?",
    });
    expect(confirmation).toBeVisible();
    await user.click(
      within(confirmation).getByRole("button", { name: "Cancel" }),
    );
    expect(window).toBeVisible();

    await user.click(
      within(window).getByRole("button", { name: "Close Mira Vale" }),
    );
    await user.click(screen.getByRole("button", { name: "Save and close" }));

    await waitFor(() => {
      const saveCall = fetchMock.mock.calls.find(
        ([input, init]) =>
          pathOf(input) === `/api/entries/${entry.id}` &&
          init?.method === "PATCH" &&
          typeof init.body === "string" &&
          init.body.includes("Mira Revised"),
      );
      expect(saveCall).toBeDefined();
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Mira Vale" }),
      ).not.toBeInTheDocument(),
    );
  });
});
