import type { Entry, WorkspaceWindowDescriptor } from "./api.js";

export const DEFAULT_WINDOW_WIDTH = 680;
export const DEFAULT_WINDOW_HEIGHT = 520;
export const MIN_WINDOW_WIDTH = 320;
export const MIN_WINDOW_HEIGHT = 240;
const WINDOW_OFFSET = 36;
const Z_ORDER_RENUMBER_THRESHOLD = 1_000_000_000;

export interface WorkspaceWindow extends WorkspaceWindowDescriptor {
  entry?: Entry;
  loadState: "loading" | "ready" | "error";
  loadError: string | undefined;
  isDirty: boolean;
}

export type WorkspaceSaveStatus = "idle" | "saving" | "saved" | "failed";

export interface WorkspaceState {
  windows: WorkspaceWindow[];
  layoutVersion: number;
  saveStatus: WorkspaceSaveStatus;
  saveError: string | undefined;
}

export type WorkspaceAction =
  | { type: "hydrate"; windows: WorkspaceWindowDescriptor[] }
  | { type: "entry-loaded"; entry: Entry }
  | { type: "entry-load-failed"; entryId: string; message: string }
  | { type: "open"; entry: Entry }
  | { type: "focus"; entryId: string }
  | {
      type: "geometry";
      entryId: string;
      geometry: Pick<WorkspaceWindowDescriptor, "x" | "y" | "width" | "height">;
    }
  | { type: "minimize"; entryId: string }
  | { type: "close"; entryId: string }
  | { type: "dirty"; entryId: string; isDirty: boolean }
  | { type: "entry-updated"; entry: Entry }
  | { type: "save-started" }
  | { type: "save-succeeded" }
  | { type: "save-failed"; message: string };

export const initialWorkspaceState: WorkspaceState = {
  windows: [],
  layoutVersion: 0,
  saveStatus: "idle",
  saveError: undefined,
};

function withLayoutChange(
  state: WorkspaceState,
  windows: WorkspaceWindow[],
): WorkspaceState {
  return {
    ...state,
    windows,
    layoutVersion: state.layoutVersion + 1,
  };
}

function orderedWindows(windows: WorkspaceWindow[]) {
  return [...windows].sort(
    (left, right) =>
      left.zOrder - right.zOrder || left.entryId.localeCompare(right.entryId),
  );
}

function nextZOrder(windows: WorkspaceWindow[]) {
  return (
    windows.reduce((highest, window) => Math.max(highest, window.zOrder), 0) + 1
  );
}

function focusWindow(windows: WorkspaceWindow[], entryId: string) {
  const target = windows.find((window) => window.entryId === entryId);
  if (!target) return windows;
  const highest = nextZOrder(windows) - 1;
  if (!target.isMinimized && target.zOrder === highest) return windows;

  let next = windows.map((window) =>
    window.entryId === entryId
      ? { ...window, isMinimized: false, zOrder: highest + 1 }
      : window,
  );
  if (highest + 1 >= Z_ORDER_RENUMBER_THRESHOLD) {
    next = orderedWindows(next).map((window, index) => ({
      ...window,
      zOrder: index + 1,
    }));
  }
  return next;
}

function newWindow(entry: Entry, windows: WorkspaceWindow[]): WorkspaceWindow {
  const offsetIndex = windows.length % 8;
  return {
    entryId: entry.id,
    x: 24 + offsetIndex * WINDOW_OFFSET,
    y: 24 + offsetIndex * WINDOW_OFFSET,
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    zOrder: nextZOrder(windows),
    isMinimized: false,
    entry,
    loadState: "ready",
    loadError: undefined,
    isDirty: false,
  };
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        windows: orderedWindows(
          action.windows.map((window) => ({
            ...window,
            loadState: "loading" as const,
            loadError: undefined,
            isDirty: false,
          })),
        ),
        layoutVersion: 0,
        saveStatus: "idle",
        saveError: undefined,
      };
    case "entry-loaded":
    case "entry-updated":
      return {
        ...state,
        windows: state.windows.map((window) =>
          window.entryId === action.entry.id
            ? {
                ...window,
                entry: action.entry,
                loadState: "ready" as const,
                loadError: undefined,
              }
            : window,
        ),
      };
    case "entry-load-failed":
      return {
        ...state,
        windows: state.windows.map((window) =>
          window.entryId === action.entryId
            ? {
                ...window,
                loadState: "error" as const,
                loadError: action.message,
              }
            : window,
        ),
      };
    case "open": {
      const existing = state.windows.some(
        (window) => window.entryId === action.entry.id,
      );
      return existing
        ? withLayoutChange(
            state,
            focusWindow(
              state.windows.map((window) =>
                window.entryId === action.entry.id
                  ? {
                      ...window,
                      entry: action.entry,
                      loadState: "ready" as const,
                      loadError: undefined,
                    }
                  : window,
              ),
              action.entry.id,
            ),
          )
        : withLayoutChange(state, [
            ...state.windows,
            newWindow(action.entry, state.windows),
          ]);
    }
    case "focus": {
      const windows = focusWindow(state.windows, action.entryId);
      return windows === state.windows
        ? state
        : withLayoutChange(state, windows);
    }
    case "geometry": {
      const current = state.windows.find(
        (window) => window.entryId === action.entryId,
      );
      if (
        !current ||
        (current.x === action.geometry.x &&
          current.y === action.geometry.y &&
          current.width === action.geometry.width &&
          current.height === action.geometry.height)
      ) {
        return state;
      }
      return withLayoutChange(
        state,
        state.windows.map((window) =>
          window.entryId === action.entryId
            ? { ...window, ...action.geometry }
            : window,
        ),
      );
    }
    case "minimize": {
      const target = state.windows.find(
        (window) => window.entryId === action.entryId,
      );
      if (!target || target.isMinimized) return state;
      return withLayoutChange(
        state,
        state.windows.map((window) =>
          window.entryId === action.entryId
            ? { ...window, isMinimized: true }
            : window,
        ),
      );
    }
    case "close":
      return state.windows.some((window) => window.entryId === action.entryId)
        ? withLayoutChange(
            state,
            state.windows.filter((window) => window.entryId !== action.entryId),
          )
        : state;
    case "dirty":
      if (
        state.windows.find((window) => window.entryId === action.entryId)
          ?.isDirty === action.isDirty
      ) {
        return state;
      }
      return {
        ...state,
        windows: state.windows.map((window) =>
          window.entryId === action.entryId
            ? { ...window, isDirty: action.isDirty }
            : window,
        ),
      };
    case "save-started":
      return { ...state, saveStatus: "saving", saveError: undefined };
    case "save-succeeded":
      return { ...state, saveStatus: "saved", saveError: undefined };
    case "save-failed":
      return {
        ...state,
        saveStatus: "failed",
        saveError: action.message,
      };
  }
}

export function workspaceSnapshot(
  windows: WorkspaceWindow[],
): WorkspaceWindowDescriptor[] {
  return orderedWindows(windows).map(
    ({ entryId, x, y, width, height, zOrder, isMinimized }) => ({
      entryId,
      x,
      y,
      width,
      height,
      zOrder,
      isMinimized,
    }),
  );
}

export function clampWindowGeometry(
  window: WorkspaceWindowDescriptor,
  bounds: { width: number; height: number },
) {
  const width = Math.max(
    MIN_WINDOW_WIDTH,
    Math.min(window.width, Math.max(MIN_WINDOW_WIDTH, bounds.width)),
  );
  const height = Math.max(
    MIN_WINDOW_HEIGHT,
    Math.min(window.height, Math.max(MIN_WINDOW_HEIGHT, bounds.height)),
  );
  return {
    x: Math.max(0, Math.min(window.x, Math.max(0, bounds.width - width))),
    y: Math.max(0, Math.min(window.y, Math.max(0, bounds.height - height))),
    width,
    height,
  };
}
