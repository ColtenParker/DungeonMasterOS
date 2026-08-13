import { describe, expect, it } from "vitest";

import type { Entry, WorkspaceWindowDescriptor } from "./api.js";
import {
  clampWindowGeometry,
  initialWorkspaceState,
  workspaceReducer,
  workspaceSnapshot,
} from "./workspace-state.js";

const entry: Entry = {
  id: "0198a5d0-3d4a-7000-8000-000000000003",
  type: "NPC",
  title: "Mira Vale",
  document: { type: "doc", content: [{ type: "paragraph" }] },
  documentVersion: 1,
  sections: [],
  specialization: {
    type: "NPC",
    portraitMediaId: null,
    status: null,
    currentLocationId: null,
    inventories: [],
  },
  scope: {
    kind: "world",
    id: "0198a5d0-3d4a-7000-8000-000000000001",
  },
  isArchived: false,
  createdAt: "2026-08-11T23:00:00.000Z",
  updatedAt: "2026-08-11T23:00:00.000Z",
};

const descriptor: WorkspaceWindowDescriptor = {
  entryId: entry.id,
  x: 40,
  y: 50,
  width: 640,
  height: 480,
  zOrder: 2,
  isMinimized: true,
};

describe("workspace state", () => {
  it("hydrates persisted descriptors without scheduling a save", () => {
    const state = workspaceReducer(initialWorkspaceState, {
      type: "hydrate",
      windows: [descriptor],
    });

    expect(state.layoutVersion).toBe(0);
    expect(state.windows[0]).toMatchObject({
      ...descriptor,
      loadState: "loading",
      isDirty: false,
    });
  });

  it("opens once and restores and focuses a duplicate Entry", () => {
    let state = workspaceReducer(initialWorkspaceState, {
      type: "hydrate",
      windows: [descriptor],
    });
    state = workspaceReducer(state, { type: "entry-loaded", entry });
    state = workspaceReducer(state, { type: "open", entry });

    expect(state.windows).toHaveLength(1);
    expect(state.windows[0]).toMatchObject({
      entryId: entry.id,
      isMinimized: false,
    });
    expect(state.layoutVersion).toBe(1);
  });

  it("persists geometry, minimize, focus, and close transitions", () => {
    let state = workspaceReducer(initialWorkspaceState, {
      type: "open",
      entry,
    });
    state = workspaceReducer(state, {
      type: "geometry",
      entryId: entry.id,
      geometry: { x: 80, y: 90, width: 720, height: 560 },
    });
    state = workspaceReducer(state, { type: "minimize", entryId: entry.id });

    expect(workspaceSnapshot(state.windows)[0]).toMatchObject({
      x: 80,
      y: 90,
      width: 720,
      height: 560,
      isMinimized: true,
    });

    state = workspaceReducer(state, { type: "focus", entryId: entry.id });
    expect(state.windows[0]?.isMinimized).toBe(false);
    state = workspaceReducer(state, { type: "close", entryId: entry.id });
    expect(state.windows).toEqual([]);
  });

  it("tracks document dirtiness without scheduling a layout save", () => {
    let state = workspaceReducer(initialWorkspaceState, {
      type: "open",
      entry,
    });
    const layoutVersion = state.layoutVersion;
    state = workspaceReducer(state, {
      type: "dirty",
      entryId: entry.id,
      isDirty: true,
    });

    expect(state.windows[0]?.isDirty).toBe(true);
    expect(state.layoutVersion).toBe(layoutVersion);
  });

  it("clamps restored geometry into a smaller viewport", () => {
    expect(
      clampWindowGeometry(
        { ...descriptor, x: 900, y: 700, width: 800, height: 700 },
        { width: 600, height: 500 },
      ),
    ).toEqual({ x: 0, y: 0, width: 600, height: 500 });
  });
});
