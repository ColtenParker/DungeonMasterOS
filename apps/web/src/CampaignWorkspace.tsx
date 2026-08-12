import {
  type FormEvent,
  type RefCallback,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { Rnd } from "react-rnd";
import { useNavigate, useParams } from "react-router";

import {
  type ArchiveFilter,
  type Campaign,
  createCampaignEntry,
  createWorldEntry,
  type Entry,
  type EntryType,
  getCampaign,
  getCampaignWorkspace,
  getEntry,
  getWorld,
  createMapMarker,
  deleteMapMarker,
  listCampaignMedia,
  listMapMarkers,
  listCampaignEntries,
  listWorldTags,
  replaceCampaignWorkspace,
  searchCampaignEntries,
  searchWorldEntries,
  type Tag,
  type MapMarker,
  type Media,
  updateEntry,
  updateCampaignWorkspaceBackground,
  updateMapMarker,
  type WorkspaceWindowDescriptor,
  type World,
} from "./api.js";
import { EntryEditor, type EntryEditorHandle } from "./EntryEditor.js";
import { EntryKnowledgePanel } from "./EntryKnowledgePanel.js";
import { QuickOpen } from "./QuickOpen.js";
import { containedImageBounds } from "./media-layout.js";
import {
  clampWindowGeometry,
  initialWorkspaceState,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  type WorkspaceWindow,
  type WorkspaceState,
  workspaceReducer,
  workspaceSnapshot,
} from "./workspace-state.js";

const typeLabels: Record<EntryType, string> = {
  NPC: "NPC",
  LOCATION: "Location",
  JOURNAL: "Journal",
};

interface WorkspaceEntryBrowserProps {
  world: World;
  campaign: Campaign;
  revision: number;
  onError: (message: string) => void;
  mediaControls: ReactNode;
}

interface CampaignWorkspaceContextValue {
  state: WorkspaceState;
  openEntry: (entry: Entry) => void;
  openEntryId: (entryId: string) => Promise<void>;
}

const CampaignWorkspaceContext =
  createContext<CampaignWorkspaceContextValue | null>(null);

function useCampaignWorkspaceContext() {
  const value = useContext(CampaignWorkspaceContext);
  if (!value) throw new Error("Campaign workspace context is missing.");
  return value;
}

function WorkspaceEntryBrowser({
  world,
  campaign,
  revision,
  onError,
  mediaControls,
}: WorkspaceEntryBrowserProps) {
  const { openEntry } = useCampaignWorkspaceContext();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [archive, setArchive] = useState<ArchiveFilter>("active");
  const [type, setType] = useState<EntryType | "all">("all");
  const [searchText, setSearchText] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [newType, setNewType] = useState<EntryType>("NPC");
  const [newTitle, setNewTitle] = useState("");
  const [newScope, setNewScope] = useState<"campaign" | "world">("campaign");

  const refresh = useCallback(async () => {
    const selectedType = type === "all" ? undefined : type;
    const result =
      activeQuery || tagFilter
        ? await searchCampaignEntries(campaign.id, {
            archive,
            ...(activeQuery ? { query: activeQuery } : {}),
            ...(selectedType ? { type: selectedType } : {}),
            ...(tagFilter ? { tag: tagFilter } : {}),
          })
        : await listCampaignEntries(campaign.id, archive, selectedType);
    setEntries(result.items);
  }, [activeQuery, archive, campaign.id, tagFilter, type]);

  useEffect(() => {
    refresh().catch((reason: unknown) =>
      onError(
        reason instanceof Error ? reason.message : "Could not load Entries.",
      ),
    );
  }, [onError, refresh, revision]);

  useEffect(() => {
    listWorldTags(world.id)
      .then((result) => setAvailableTags(result.items))
      .catch((reason: unknown) =>
        onError(
          reason instanceof Error ? reason.message : "Could not load tags.",
        ),
      );
  }, [onError, revision, world.id]);

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await createCampaignEntry(campaign.id, {
        type: newType,
        title: newTitle,
        scope: newScope,
      });
      setNewTitle("");
      openEntry(created);
      await refresh();
    } catch (reason) {
      onError(
        reason instanceof Error ? reason.message : "Could not create Entry.",
      );
    }
  }

  const parentArchived = world.isArchived || campaign.isArchived;

  return (
    <aside className="workspace-sidebar" aria-label="Campaign Entry browser">
      <div className="workspace-sidebar-heading">
        <div>
          <p className="eyebrow">Campaign workspace</p>
          <h1>{campaign.name}</h1>
          <small>{world.name}</small>
        </div>
      </div>

      <QuickOpen
        world={world}
        campaign={campaign}
        onOpen={openEntry}
        onError={onError}
      />

      {mediaControls}

      <form
        className="workspace-search"
        onSubmit={(event) => {
          event.preventDefault();
          setActiveQuery(searchText.trim());
        }}
      >
        <label>
          Search Entries
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            maxLength={200}
          />
        </label>
        <button type="submit">Search</button>
        {(activeQuery || tagFilter) && (
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setSearchText("");
              setActiveQuery("");
              setTagFilter("");
            }}
          >
            Clear
          </button>
        )}
      </form>

      <div className="workspace-filters">
        <label>
          Category
          <select
            value={type}
            onChange={(event) =>
              setType(event.target.value as EntryType | "all")
            }
          >
            <option value="all">All</option>
            <option value="NPC">NPCs</option>
            <option value="LOCATION">Locations</option>
            <option value="JOURNAL">Journals</option>
          </select>
        </label>
        <label>
          Show
          <select
            value={archive}
            onChange={(event) =>
              setArchive(event.target.value as ArchiveFilter)
            }
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>
        <label>
          Tag
          <select
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
          >
            <option value="">All</option>
            {availableTags.map((tag) => (
              <option value={tag.name} key={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!parentArchived && (
        <form
          className="workspace-create"
          onSubmit={(event) => void create(event)}
        >
          <label>
            New Entry
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              maxLength={120}
              required
            />
          </label>
          <div className="workspace-create-options">
            <label>
              Type
              <select
                value={newType}
                onChange={(event) =>
                  setNewType(event.target.value as EntryType)
                }
              >
                <option value="NPC">NPC</option>
                <option value="LOCATION">Location</option>
                <option value="JOURNAL">Journal</option>
              </select>
            </label>
            <label>
              Scope
              <select
                value={newScope}
                onChange={(event) =>
                  setNewScope(event.target.value as "campaign" | "world")
                }
              >
                <option value="campaign">Campaign</option>
                <option value="world">World</option>
              </select>
            </label>
          </div>
          <button type="submit">Create and Open</button>
        </form>
      )}

      {entries.length ? (
        <ul className="workspace-entry-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button type="button" onClick={() => openEntry(entry)}>
                <span>
                  <strong>{entry.title}</strong>
                  <small>{typeLabels[entry.type]}</small>
                </span>
                <span className="entry-meta">
                  <small>
                    {entry.scope.kind === "world" ? "World" : "Campaign"}
                  </small>
                  {entry.isArchived && <small>Archived</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">No matching Entries.</p>
      )}
    </aside>
  );
}

function useWorkspaceBounds(ref: React.RefObject<HTMLDivElement | null>) {
  const [bounds, setBounds] = useState({ width: 1280, height: 800 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const next = element.getBoundingClientRect();
      if (next.width > 0 && next.height > 0) {
        setBounds({ width: next.width, height: next.height });
      }
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return bounds;
}

interface WorkspaceEntryWindowProps {
  window: WorkspaceWindow;
  world: World;
  bounds: { width: number; height: number };
  editorRef: RefCallback<EntryEditorHandle>;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onGeometry: (
    geometry: Pick<WorkspaceWindowDescriptor, "x" | "y" | "width" | "height">,
  ) => void;
  onDirtyChange: (isDirty: boolean) => void;
  onSave: (input: Pick<Entry, "title" | "document">) => Promise<void>;
  onArchive: () => Promise<void>;
  onSearchEntries: (query: string) => Promise<Entry[]>;
  onCreateLinkedEntry: (input: {
    type: EntryType;
    title: string;
    scope: "world" | "campaign";
  }) => Promise<Entry>;
  onOpenEntryId: (entryId: string) => void;
  onError: (message: string) => void;
}

function WorkspaceEntryWindow({
  window,
  world,
  bounds,
  editorRef,
  onFocus,
  onMinimize,
  onClose,
  onGeometry,
  onDirtyChange,
  onSave,
  onArchive,
  onSearchEntries,
  onCreateLinkedEntry,
  onOpenEntryId,
  onError,
}: WorkspaceEntryWindowProps) {
  const geometry = clampWindowGeometry(window, bounds);
  const title = window.entry?.title ?? "Entry";
  const titleId = `workspace-window-title-${window.entryId}`;

  return (
    <Rnd
      bounds="parent"
      dragHandleClassName="workspace-window-titlebar"
      cancel="button,input,textarea,select,.tiptap"
      minWidth={MIN_WINDOW_WIDTH}
      minHeight={MIN_WINDOW_HEIGHT}
      resizeHandleClasses={{ bottomRight: "workspace-resize-handle" }}
      size={{ width: geometry.width, height: geometry.height }}
      position={{ x: geometry.x, y: geometry.y }}
      style={{
        zIndex: window.zOrder,
        display: window.isMinimized ? "none" : "flex",
      }}
      onMouseDown={onFocus}
      onDragStop={(_event, data) =>
        onGeometry({
          ...geometry,
          x: Math.round(data.x),
          y: Math.round(data.y),
        })
      }
      onResizeStop={(_event, _direction, element, _delta, position) =>
        onGeometry({
          x: Math.round(position.x),
          y: Math.round(position.y),
          width: Math.round(element.offsetWidth),
          height: Math.round(element.offsetHeight),
        })
      }
      className="workspace-window"
      data-entry-window={window.entryId}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <header className="workspace-window-titlebar">
        <div>
          <strong id={titleId}>{title}</strong>
          {window.entry && (
            <small>
              {typeLabels[window.entry.type]}
              {window.entry.scope.kind === "world" ? " · World" : " · Campaign"}
              {window.entry.isArchived ? " · Archived" : ""}
              {window.isDirty ? " · Unsaved" : ""}
            </small>
          )}
        </div>
        <div className="workspace-window-actions">
          <button
            type="button"
            className="window-control"
            aria-label={`Minimize ${title}`}
            onClick={onMinimize}
          >
            −
          </button>
          <button
            type="button"
            className="window-control danger"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </header>
      <div className="workspace-window-content">
        {window.loadState === "loading" && <p role="status">Loading Entry…</p>}
        {window.loadState === "error" && (
          <div className="error" role="alert">
            {window.loadError ?? "Could not load this Entry."}
          </div>
        )}
        {window.entry && (
          <>
            <EntryEditor
              ref={editorRef}
              entry={window.entry}
              onSave={onSave}
              onArchive={onArchive}
              onSearchEntries={onSearchEntries}
              onCreateLinkedEntry={onCreateLinkedEntry}
              onOpenEntryId={onOpenEntryId}
              onError={onError}
              onDirtyChange={onDirtyChange}
            />
            <EntryKnowledgePanel
              entry={window.entry}
              worldId={world.id}
              onSearchEntries={onSearchEntries}
              onOpenEntry={(entry) => onOpenEntryId(entry.id)}
              onError={onError}
            />
          </>
        )}
      </div>
    </Rnd>
  );
}

export function CampaignWorkspace() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [browserRevision, setBrowserRevision] = useState(0);
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const stateRef = useRef(state);
  const canvasRef = useRef<HTMLDivElement>(null);
  const bounds = useWorkspaceBounds(canvasRef);
  const editorRefs = useRef(new Map<string, EntryEditorHandle>());
  const pendingSnapshot = useRef<WorkspaceWindowDescriptor[] | null>(null);
  const failedSnapshot = useRef<WorkspaceWindowDescriptor[] | null>(null);
  const saveRunning = useRef(false);
  const [pendingCloseEntryId, setPendingCloseEntryId] = useState<string | null>(
    null,
  );
  const [leaveRequested, setLeaveRequested] = useState(false);
  const [media, setMedia] = useState<Media[]>([]);
  const [backgroundMediaId, setBackgroundMediaId] = useState<string | null>(
    null,
  );
  const [backgroundSaveState, setBackgroundSaveState] = useState<
    "idle" | "saving" | "saved" | "failed"
  >("idle");
  const [failedBackgroundId, setFailedBackgroundId] = useState<
    string | null | undefined
  >(undefined);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [markerEditMode, setMarkerEditMode] = useState(false);
  const [markerScope, setMarkerScope] = useState<"campaign" | "world">(
    "campaign",
  );
  const [markerEntryId, setMarkerEntryId] = useState("");
  const [markerLabel, setMarkerLabel] = useState("");
  const [markerTargets, setMarkerTargets] = useState<Entry[]>([]);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  stateRef.current = state;

  const drainSaves = useCallback(async () => {
    if (!campaignId || saveRunning.current) return;
    saveRunning.current = true;
    while (pendingSnapshot.current) {
      const snapshot = pendingSnapshot.current;
      pendingSnapshot.current = null;
      dispatch({ type: "save-started" });
      try {
        await replaceCampaignWorkspace(campaignId, snapshot);
        failedSnapshot.current = null;
        dispatch({ type: "save-succeeded" });
      } catch (reason) {
        failedSnapshot.current = snapshot;
        dispatch({
          type: "save-failed",
          message:
            reason instanceof Error
              ? reason.message
              : "Could not save the workspace.",
        });
        break;
      }
    }
    saveRunning.current = false;
  }, [campaignId]);

  const queueSave = useCallback(
    (snapshot: WorkspaceWindowDescriptor[]) => {
      pendingSnapshot.current = snapshot;
      void drainSaves();
    },
    [drainSaves],
  );

  useEffect(() => {
    if (state.layoutVersion > 0) {
      queueSave(workspaceSnapshot(stateRef.current.windows));
    }
  }, [queueSave, state.layoutVersion]);

  useEffect(() => {
    if (!campaignId) {
      setError("Campaign identifier is missing.");
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      getCampaign(campaignId),
      getCampaignWorkspace(campaignId),
      listCampaignMedia(campaignId, "all"),
    ])
      .then(async ([nextCampaign, workspace, mediaResult]) => {
        const nextWorld = await getWorld(nextCampaign.worldId);
        if (!active) return;
        setCampaign(nextCampaign);
        setWorld(nextWorld);
        setMedia(mediaResult.items);
        setBackgroundMediaId(workspace.backgroundMediaId);
        dispatch({ type: "hydrate", windows: workspace.windows });
        await Promise.all(
          workspace.windows.map(async ({ entryId }) => {
            try {
              const entry = await getEntry(entryId);
              if (active) dispatch({ type: "entry-loaded", entry });
            } catch (reason) {
              if (active) {
                dispatch({
                  type: "entry-load-failed",
                  entryId,
                  message:
                    reason instanceof Error
                      ? reason.message
                      : "Could not load this Entry.",
                });
              }
            }
          }),
        );
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load the Campaign workspace.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [campaignId]);

  const backgroundMedia =
    media.find(({ id }) => id === backgroundMediaId) ?? null;
  const mapBounds = backgroundMedia
    ? containedImageBounds(bounds, backgroundMedia)
    : { left: 0, top: 0, width: 0, height: 0 };

  const refreshMarkers = useCallback(async () => {
    if (!campaignId || !backgroundMedia || backgroundMedia.type !== "MAP") {
      setMarkers([]);
      return;
    }
    const result = await listMapMarkers(campaignId, backgroundMedia.id);
    setMarkers(result.items);
  }, [backgroundMedia, campaignId]);

  useEffect(() => {
    refreshMarkers().catch((reason: unknown) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not load map markers.",
      ),
    );
    setMarkerEditMode(false);
    setSelectedMarkerId(null);
  }, [refreshMarkers]);

  useEffect(() => {
    if (!markerEditMode || !campaign) return;
    listCampaignEntries(campaign.id, "all")
      .then((result) => {
        setMarkerTargets(result.items);
        setMarkerEntryId((current) => current || result.items[0]?.id || "");
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load marker targets.",
        ),
      );
  }, [campaign, markerEditMode]);

  async function saveBackground(mediaId: string | null) {
    if (!campaignId) return;
    setBackgroundMediaId(mediaId);
    setBackgroundSaveState("saving");
    try {
      await updateCampaignWorkspaceBackground(campaignId, mediaId);
      setFailedBackgroundId(undefined);
      setBackgroundSaveState("saved");
    } catch (reason) {
      setFailedBackgroundId(mediaId);
      setBackgroundSaveState("failed");
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save the background.",
      );
    }
  }

  function eligibleMarkerTargets() {
    if (!world || !campaign) return [];
    return markerTargets.filter((entry) =>
      markerScope === "world"
        ? entry.scope.kind === "world" && entry.scope.id === world.id
        : (entry.scope.kind === "world" && entry.scope.id === world.id) ||
          (entry.scope.kind === "campaign" && entry.scope.id === campaign.id),
    );
  }

  async function handleMapClick(event: React.MouseEvent<HTMLDivElement>) {
    if (
      !markerEditMode ||
      !campaign ||
      !world ||
      !backgroundMedia ||
      mapBounds.width <= 0
    )
      return;
    const rectangle = event.currentTarget.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(1, (event.clientX - rectangle.left) / rectangle.width),
    );
    const y = Math.max(
      0,
      Math.min(1, (event.clientY - rectangle.top) / rectangle.height),
    );
    try {
      if (selectedMarkerId) {
        const updated = await updateMapMarker(
          campaign.id,
          backgroundMedia.id,
          selectedMarkerId,
          { x, y },
        );
        setMarkers((current) =>
          current.map((marker) =>
            marker.id === updated.id ? updated : marker,
          ),
        );
      } else {
        if (!markerEntryId) {
          setError("Choose an Entry before placing a marker.");
          return;
        }
        const created = await createMapMarker(campaign.id, backgroundMedia.id, {
          entryId: markerEntryId,
          scope: markerScope,
          scopeId: markerScope === "world" ? world.id : campaign.id,
          x,
          y,
          ...(markerLabel ? { label: markerLabel } : {}),
        });
        setMarkers((current) => [...current, created]);
      }
      setSelectedMarkerId(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save the map marker.",
      );
    }
  }

  async function saveSelectedMarker() {
    if (!campaign || !backgroundMedia || !selectedMarkerId || !markerEntryId)
      return;
    try {
      await updateMapMarker(campaign.id, backgroundMedia.id, selectedMarkerId, {
        entryId: markerEntryId,
        label: markerLabel || null,
      });
      await refreshMarkers();
      setSelectedMarkerId(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not update the map marker.",
      );
    }
  }

  async function removeSelectedMarker() {
    if (!campaign || !backgroundMedia || !selectedMarkerId) return;
    try {
      await deleteMapMarker(campaign.id, backgroundMedia.id, selectedMarkerId);
      setSelectedMarkerId(null);
      await refreshMarkers();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not delete the map marker.",
      );
    }
  }

  const hasDirtyWindows = state.windows.some(({ isDirty }) => isDirty);

  useEffect(() => {
    if (!hasDirtyWindows) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasDirtyWindows]);

  useEffect(() => {
    if (!hasDirtyWindows) return;
    const guardHistory = () => {
      if (
        !window.confirm(
          "Discard unsaved Entry changes and leave the workspace?",
        )
      ) {
        window.history.forward();
      }
    };
    window.addEventListener("popstate", guardHistory);
    return () => window.removeEventListener("popstate", guardHistory);
  }, [hasDirtyWindows]);

  function focusWindowElement(entryId: string) {
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-entry-window="${entryId}"]`)
        ?.focus();
    });
  }

  function openEntry(entry: Entry) {
    if (
      !campaign ||
      !world ||
      !(
        (entry.scope.kind === "campaign" && entry.scope.id === campaign.id) ||
        (entry.scope.kind === "world" && entry.scope.id === world.id)
      )
    ) {
      setError("That Entry is outside this Campaign workspace's scope.");
      return;
    }
    dispatch({ type: "open", entry });
    focusWindowElement(entry.id);
  }

  async function openEntryId(entryId: string) {
    const existing = stateRef.current.windows.find(
      (window) => window.entryId === entryId,
    );
    if (existing) {
      dispatch({ type: "focus", entryId });
      focusWindowElement(entryId);
      return;
    }
    try {
      openEntry(await getEntry(entryId));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not open Entry.",
      );
    }
  }

  async function saveEntry(
    entryId: string,
    input: Pick<Entry, "title" | "document">,
  ) {
    try {
      const updated = await updateEntry(entryId, input);
      dispatch({ type: "entry-updated", entry: updated });
      setBrowserRevision((revision) => revision + 1);
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "Could not save Entry.";
      setError(message);
      throw reason;
    }
  }

  async function toggleArchive(entry: Entry) {
    try {
      const updated = await updateEntry(entry.id, {
        isArchived: !entry.isArchived,
      });
      dispatch({ type: "entry-updated", entry: updated });
      setBrowserRevision((revision) => revision + 1);
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "Could not update Entry.";
      setError(message);
      throw reason;
    }
  }

  async function searchForEntry(entry: Entry, query: string) {
    const result =
      entry.scope.kind === "campaign"
        ? await searchCampaignEntries(entry.scope.id, {
            query,
            archive: "all",
            limit: 20,
          })
        : await searchWorldEntries(entry.scope.id, {
            query,
            archive: "all",
            limit: 20,
          });
    return result.items;
  }

  async function createLinkedEntry(
    source: Entry,
    input: { type: EntryType; title: string; scope: "world" | "campaign" },
  ) {
    const created =
      source.scope.kind === "campaign"
        ? await createCampaignEntry(source.scope.id, input)
        : await createWorldEntry(source.scope.id, {
            type: input.type,
            title: input.title,
          });
    setBrowserRevision((revision) => revision + 1);
    return created;
  }

  function requestClose(window: WorkspaceWindow) {
    if (window.isDirty) setPendingCloseEntryId(window.entryId);
    else dispatch({ type: "close", entryId: window.entryId });
  }

  async function saveAndClose() {
    if (!pendingCloseEntryId) return;
    const editor = editorRefs.current.get(pendingCloseEntryId);
    if (!editor) return;
    try {
      await editor.save();
      dispatch({ type: "close", entryId: pendingCloseEntryId });
      setPendingCloseEntryId(null);
    } catch {
      // The editor and global error surface retain the failed draft and message.
    }
  }

  async function saveAllAndLeave() {
    try {
      for (const window of stateRef.current.windows.filter(
        ({ isDirty }) => isDirty,
      )) {
        const editor = editorRefs.current.get(window.entryId);
        if (editor) await editor.save();
      }
      setLeaveRequested(false);
      void navigate("/");
    } catch {
      // The failing editor remains open with its draft.
    }
  }

  function requestLeave() {
    if (hasDirtyWindows) setLeaveRequested(true);
    else void navigate("/");
  }

  if (loading) {
    return (
      <main className="workspace-loading">
        <p role="status">Loading Campaign workspace…</p>
      </main>
    );
  }

  if (!campaign || !world) {
    return (
      <main className="workspace-loading">
        <div className="error" role="alert">
          {error ?? "Campaign workspace was not found."}
        </div>
        <button type="button" onClick={() => void navigate("/")}>
          Return to library
        </button>
      </main>
    );
  }

  return (
    <CampaignWorkspaceContext.Provider
      value={{ state, openEntry, openEntryId }}
    >
      <main className="campaign-workspace">
        <div className="workspace-topbar">
          <button className="secondary" type="button" onClick={requestLeave}>
            ← Campaign library
          </button>
          <div className="workspace-status" aria-live="polite">
            {state.saveStatus === "saving" && "Saving workspace…"}
            {state.saveStatus === "saved" && "Workspace saved"}
            {state.saveStatus === "failed" && (
              <>
                <span>{state.saveError ?? "Workspace save failed."}</span>
                <button
                  type="button"
                  className="secondary compact"
                  onClick={() =>
                    queueSave(
                      failedSnapshot.current ??
                        workspaceSnapshot(state.windows),
                    )
                  }
                >
                  Retry
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="workspace-error error" role="alert">
            {error}
            <button
              type="button"
              className="secondary compact"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="workspace-layout">
          <WorkspaceEntryBrowser
            world={world}
            campaign={campaign}
            revision={browserRevision}
            onError={setError}
            mediaControls={
              <section
                className="workspace-media-controls"
                aria-label="Workspace background"
              >
                <div className="section-heading">
                  <h2>Background</h2>
                  <button
                    className="secondary compact"
                    type="button"
                    onClick={() =>
                      void navigate(`/campaigns/${campaign.id}/media`)
                    }
                  >
                    Library
                  </button>
                </div>
                <label>
                  Image or map
                  <select
                    value={backgroundMediaId ?? ""}
                    onChange={(event) =>
                      void saveBackground(event.target.value || null)
                    }
                  >
                    <option value="">Neutral background</option>
                    {media.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name} ({item.type === "MAP" ? "Map" : "Image"})
                        {item.isArchived ? " — Archived" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <small aria-live="polite">
                  {backgroundSaveState === "saving" && "Saving background…"}
                  {backgroundSaveState === "saved" && "Background saved"}
                  {backgroundSaveState === "failed" && (
                    <button
                      className="link-button"
                      type="button"
                      onClick={() =>
                        void saveBackground(failedBackgroundId ?? null)
                      }
                    >
                      Retry background save
                    </button>
                  )}
                </small>
                {backgroundMedia?.type === "MAP" &&
                  backgroundMedia.isAvailable && (
                    <div className="marker-editor-controls">
                      <button
                        type="button"
                        className={markerEditMode ? "danger" : "secondary"}
                        onClick={() => {
                          setMarkerEditMode((active) => !active);
                          setSelectedMarkerId(null);
                        }}
                      >
                        {markerEditMode
                          ? "Exit marker editing"
                          : "Edit map markers"}
                      </button>
                      {markerEditMode && (
                        <>
                          {backgroundMedia.scope.kind === "world" && (
                            <label>
                              Marker scope
                              <select
                                value={markerScope}
                                onChange={(event) => {
                                  setMarkerScope(
                                    event.target.value as "campaign" | "world",
                                  );
                                  setMarkerEntryId("");
                                }}
                              >
                                <option value="campaign">Campaign</option>
                                <option value="world">World</option>
                              </select>
                            </label>
                          )}
                          <label>
                            Target Entry
                            <select
                              value={markerEntryId}
                              onChange={(event) =>
                                setMarkerEntryId(event.target.value)
                              }
                            >
                              <option value="">Choose an Entry</option>
                              {eligibleMarkerTargets().map((entry) => (
                                <option key={entry.id} value={entry.id}>
                                  {entry.title}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Optional label
                            <input
                              value={markerLabel}
                              onChange={(event) =>
                                setMarkerLabel(event.target.value)
                              }
                              maxLength={120}
                            />
                          </label>
                          <small>
                            {selectedMarkerId
                              ? "Click the map to move the selected marker."
                              : "Click the map to place a marker."}
                          </small>
                          {selectedMarkerId && (
                            <div className="marker-actions">
                              <button
                                type="button"
                                onClick={() => void saveSelectedMarker()}
                              >
                                Update target
                              </button>
                              <button
                                className="secondary danger"
                                type="button"
                                onClick={() => void removeSelectedMarker()}
                              >
                                Delete marker
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
              </section>
            }
          />
          <div
            className="workspace-canvas"
            ref={canvasRef}
            aria-label={`${campaign.name} workspace`}
          >
            {backgroundMedia?.isAvailable ? (
              <div
                className={`workspace-background-stage${markerEditMode ? " editing" : ""}`}
                style={{
                  left: mapBounds.left,
                  top: mapBounds.top,
                  width: mapBounds.width,
                  height: mapBounds.height,
                }}
                onClick={(event) => void handleMapClick(event)}
              >
                <img
                  src={backgroundMedia.urls.display}
                  alt=""
                  draggable={false}
                />
                {backgroundMedia.type === "MAP" &&
                  markers.map((marker) => {
                    const target = markerTargets.find(
                      ({ id }) => id === marker.entryId,
                    );
                    return (
                      <button
                        key={marker.id}
                        type="button"
                        className={`map-marker${selectedMarkerId === marker.id ? " selected" : ""}`}
                        style={{
                          left: `${marker.x * 100}%`,
                          top: `${marker.y * 100}%`,
                        }}
                        aria-label={`${marker.label ?? target?.title ?? "Map marker"}${marker.scope.kind === "world" ? " (World)" : " (Campaign)"}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (markerEditMode) {
                            setSelectedMarkerId(marker.id);
                            setMarkerEntryId(marker.entryId);
                            setMarkerLabel(marker.label ?? "");
                            setMarkerScope(marker.scope.kind);
                          } else {
                            void openEntryId(marker.entryId);
                          }
                        }}
                      >
                        <span aria-hidden="true">●</span>
                      </button>
                    );
                  })}
              </div>
            ) : (
              <div className="workspace-empty-state" aria-hidden="true">
                <span>{campaign.name}</span>
                <small>
                  {backgroundMedia
                    ? "The selected background is unavailable."
                    : "Open an Entry from the sidebar or press Ctrl K."}
                </small>
              </div>
            )}
            {state.windows.map((workspaceWindow) => {
              const entry = workspaceWindow.entry;
              return (
                <WorkspaceEntryWindow
                  key={workspaceWindow.entryId}
                  window={workspaceWindow}
                  world={world}
                  bounds={bounds}
                  editorRef={(handle) => {
                    if (handle) {
                      editorRefs.current.set(workspaceWindow.entryId, handle);
                    } else {
                      editorRefs.current.delete(workspaceWindow.entryId);
                    }
                  }}
                  onFocus={() =>
                    dispatch({
                      type: "focus",
                      entryId: workspaceWindow.entryId,
                    })
                  }
                  onMinimize={() =>
                    dispatch({
                      type: "minimize",
                      entryId: workspaceWindow.entryId,
                    })
                  }
                  onClose={() => requestClose(workspaceWindow)}
                  onGeometry={(geometry) =>
                    dispatch({
                      type: "geometry",
                      entryId: workspaceWindow.entryId,
                      geometry,
                    })
                  }
                  onDirtyChange={(isDirty) =>
                    dispatch({
                      type: "dirty",
                      entryId: workspaceWindow.entryId,
                      isDirty,
                    })
                  }
                  onSave={(input) => saveEntry(workspaceWindow.entryId, input)}
                  onArchive={() =>
                    entry ? toggleArchive(entry) : Promise.resolve()
                  }
                  onSearchEntries={(query) =>
                    entry ? searchForEntry(entry, query) : Promise.resolve([])
                  }
                  onCreateLinkedEntry={(input) => {
                    if (!entry)
                      return Promise.reject(new Error("Entry is loading."));
                    return createLinkedEntry(entry, input);
                  }}
                  onOpenEntryId={(entryId) => void openEntryId(entryId)}
                  onError={setError}
                />
              );
            })}
          </div>
        </div>

        {state.windows.some(({ isMinimized }) => isMinimized) && (
          <nav className="workspace-dock" aria-label="Minimized Entry windows">
            {state.windows
              .filter(({ isMinimized }) => isMinimized)
              .map((workspaceWindow) => (
                <button
                  key={workspaceWindow.entryId}
                  type="button"
                  onClick={() => {
                    dispatch({
                      type: "focus",
                      entryId: workspaceWindow.entryId,
                    });
                    focusWindowElement(workspaceWindow.entryId);
                  }}
                >
                  Restore {workspaceWindow.entry?.title ?? "Entry"}
                  {workspaceWindow.isDirty ? " · Unsaved" : ""}
                </button>
              ))}
          </nav>
        )}

        {pendingCloseEntryId && (
          <section
            className="workspace-confirmation"
            role="alertdialog"
            aria-labelledby="close-entry-title"
          >
            <h2 id="close-entry-title">Save changes before closing?</h2>
            <p>This Entry has changes that have not been saved.</p>
            <div className="confirmation-actions">
              <button type="button" onClick={() => void saveAndClose()}>
                Save and close
              </button>
              <button
                type="button"
                className="secondary danger"
                onClick={() => {
                  dispatch({ type: "close", entryId: pendingCloseEntryId });
                  setPendingCloseEntryId(null);
                }}
              >
                Discard
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setPendingCloseEntryId(null)}
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {leaveRequested && (
          <section
            className="workspace-confirmation"
            role="alertdialog"
            aria-labelledby="leave-workspace-title"
          >
            <h2 id="leave-workspace-title">Leave with unsaved Entries?</h2>
            <p>Save every changed Entry, discard the drafts, or stay here.</p>
            <div className="confirmation-actions">
              <button type="button" onClick={() => void saveAllAndLeave()}>
                Save all and leave
              </button>
              <button
                type="button"
                className="secondary danger"
                onClick={() => void navigate("/")}
              >
                Discard and leave
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setLeaveRequested(false)}
              >
                Cancel
              </button>
            </div>
          </section>
        )}
      </main>
    </CampaignWorkspaceContext.Provider>
  );
}
