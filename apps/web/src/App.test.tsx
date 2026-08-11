import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App.js";
import type { Campaign, World } from "./api.js";

const world: World = {
  id: "0198a5d0-3d4a-7000-8000-000000000001",
  name: "Eldoria",
  description: null,
  isArchived: false,
  createdAt: "2026-08-11T16:00:00.000Z",
  updatedAt: "2026-08-11T16:00:00.000Z",
};

const campaign: Campaign = {
  ...world,
  id: "0198a5d0-3d4a-7000-8000-000000000002",
  worldId: world.id,
  name: "The Broken Crown",
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

describe("World and Campaign management", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("lists and opens Worlds, then lists and opens their Campaigns", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input) => {
        const path = requestPath(input);
        if (path.includes("/entries")) return response({ items: [] });
        if (path.includes("/campaigns")) return response({ items: [campaign] });
        return response({ items: [world] });
      });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Eldoria" }));
    expect(
      await screen.findByRole("region", { name: "World details" }),
    ).toBeVisible();
    await user.click(
      await screen.findByRole("button", { name: "The Broken Crown" }),
    );

    expect(
      screen.getByRole("region", { name: "Campaign details" }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/worlds?archive=active",
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/worlds/${world.id}/campaigns?archive=active`,
      expect.anything(),
    );
  });

  it("creates a World and opens it", async () => {
    let created = false;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const path = requestPath(input);
      if (path === "/api/worlds" && init?.method === "POST") {
        created = true;
        return response(world, 201);
      }
      if (path.includes("/entries")) return response({ items: [] });
      if (path.includes("/campaigns")) return response({ items: [] });
      return response({ items: created ? [world] : [] });
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("New World name"), "Eldoria");
    await user.click(screen.getByRole("button", { name: "Create World" }));

    expect(
      await screen.findByRole("region", { name: "World details" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Eldoria" })).toBeVisible();
  });

  it("edits and archives an open World", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input, init) => {
        const path = requestPath(input);
        if (path === `/api/worlds/${world.id}` && init?.method === "PATCH") {
          const body = JSON.parse(requestBody(init)) as Partial<World>;
          return response({ ...world, ...body });
        }
        if (path.includes("/entries")) return response({ items: [] });
        if (path.includes("/campaigns")) return response({ items: [] });
        return response({ items: [world] });
      });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Eldoria" }));
    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Eldoria Revised");
    await user.click(screen.getByRole("button", { name: "Save World" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/worlds/${world.id}`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ name: "Eldoria Revised", description: null }),
        }),
      ),
    );

    await user.click(screen.getByRole("button", { name: "Archive World" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/worlds/${world.id}`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ isArchived: true }),
        }),
      ),
    );
    expect(
      screen.queryByRole("region", { name: "World details" }),
    ).not.toBeInTheDocument();
  });

  it("shows safe API errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "World service unavailable." } }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "World service unavailable.",
    );
  });
});
