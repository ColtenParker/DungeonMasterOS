import { FormEvent, useCallback, useEffect, useState } from "react";
import { Route, Routes, useNavigate } from "react-router";

import {
  type ArchiveFilter,
  type Campaign,
  createCampaign,
  createWorld,
  listCampaigns,
  listWorlds,
  updateCampaign,
  updateWorld,
  type World,
} from "./api.js";
import { EntryManager } from "./EntryManager.js";
import { CampaignWorkspace } from "./CampaignWorkspace.js";
import { MediaLibrary } from "./MediaLibrary.js";

interface EditorProps {
  resource: World | Campaign;
  kind: "World" | "Campaign";
  onSave: (input: {
    name: string;
    description: string | null;
  }) => Promise<void>;
  onArchive: () => Promise<void>;
}

function ResourceEditor({ resource, kind, onSave, onArchive }: EditorProps) {
  const [name, setName] = useState(resource.name);
  const [description, setDescription] = useState(resource.description ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(resource.name);
    setDescription(resource.description ?? "");
  }, [resource]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({ name, description: description || null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="editor" aria-label={`${kind} details`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Open {kind}</p>
          <h2>{resource.name}</h2>
        </div>
        <button
          className="secondary danger"
          type="button"
          onClick={() => void onArchive()}
        >
          {resource.isArchived ? `Restore ${kind}` : `Archive ${kind}`}
        </button>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <label>
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            required
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={5000}
            rows={5}
          />
        </label>
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : `Save ${kind}`}
        </button>
      </form>
    </section>
  );
}

function ArchiveSelect({
  value,
  onChange,
}: {
  value: ArchiveFilter;
  onChange: (value: ArchiveFilter) => void;
}) {
  return (
    <label className="filter">
      Show
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as ArchiveFilter)}
      >
        <option value="active">Active</option>
        <option value="archived">Archived</option>
        <option value="all">All</option>
      </select>
    </label>
  );
}

function CampaignLibrary() {
  const navigate = useNavigate();
  const [worlds, setWorlds] = useState<World[]>([]);
  const [worldFilter, setWorldFilter] = useState<ArchiveFilter>("active");
  const [selectedWorld, setSelectedWorld] = useState<World | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignFilter, setCampaignFilter] = useState<ArchiveFilter>("active");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    null,
  );
  const [worldName, setWorldName] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshWorlds = useCallback(async () => {
    const result = await listWorlds(worldFilter);
    setWorlds(result.items);
  }, [worldFilter]);

  const refreshCampaigns = useCallback(async () => {
    if (!selectedWorld) {
      setCampaigns([]);
      return;
    }
    const result = await listCampaigns(selectedWorld.id, campaignFilter);
    setCampaigns(result.items);
  }, [campaignFilter, selectedWorld]);

  useEffect(() => {
    setLoading(true);
    refreshWorlds()
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Could not load Worlds.",
        ),
      )
      .finally(() => setLoading(false));
  }, [refreshWorlds]);

  useEffect(() => {
    setSelectedCampaign(null);
    refreshCampaigns().catch((reason: unknown) =>
      setError(
        reason instanceof Error ? reason.message : "Could not load Campaigns.",
      ),
    );
  }, [refreshCampaigns]);

  async function addWorld(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const created = await createWorld({ name: worldName });
      setWorldName("");
      setSelectedWorld(created);
      await refreshWorlds();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not create World.",
      );
    }
  }

  async function saveWorld(input: {
    name: string;
    description: string | null;
  }) {
    if (!selectedWorld) return;
    try {
      const updated = await updateWorld(selectedWorld.id, input);
      setSelectedWorld(updated);
      await refreshWorlds();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not update World.",
      );
    }
  }

  async function toggleWorldArchive() {
    if (!selectedWorld) return;
    try {
      await updateWorld(selectedWorld.id, {
        isArchived: !selectedWorld.isArchived,
      });
      setSelectedWorld(null);
      setSelectedCampaign(null);
      await refreshWorlds();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not update World.",
      );
    }
  }

  async function addCampaign(event: FormEvent) {
    event.preventDefault();
    if (!selectedWorld) return;
    try {
      const created = await createCampaign(selectedWorld.id, {
        name: campaignName,
      });
      setCampaignName("");
      setSelectedCampaign(created);
      await refreshCampaigns();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not create Campaign.",
      );
    }
  }

  async function saveCampaign(input: {
    name: string;
    description: string | null;
  }) {
    if (!selectedCampaign) return;
    try {
      const updated = await updateCampaign(selectedCampaign.id, input);
      setSelectedCampaign(updated);
      await refreshCampaigns();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not update Campaign.",
      );
    }
  }

  async function toggleCampaignArchive() {
    if (!selectedCampaign) return;
    try {
      await updateCampaign(selectedCampaign.id, {
        isArchived: !selectedCampaign.isArchived,
      });
      setSelectedCampaign(null);
      await refreshCampaigns();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not update Campaign.",
      );
    }
  }

  return (
    <main>
      <header className="app-header">
        <div>
          <p className="eyebrow">Campaign library</p>
          <h1>Dungeon Master OS</h1>
        </div>
        <p>Build interconnected Worlds one Entry at a time.</p>
      </header>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <div className="domain-grid">
        <aside className="browser" aria-label="World browser">
          <div className="section-heading">
            <h2>Worlds</h2>
            <ArchiveSelect value={worldFilter} onChange={setWorldFilter} />
          </div>
          <form
            className="quick-create"
            onSubmit={(event) => void addWorld(event)}
          >
            <label>
              New World name
              <input
                value={worldName}
                onChange={(event) => setWorldName(event.target.value)}
                maxLength={120}
                required
              />
            </label>
            <button type="submit">Create World</button>
          </form>
          {loading ? (
            <p role="status">Loading Worlds…</p>
          ) : worlds.length ? (
            <ul className="resource-list">
              {worlds.map((world) => (
                <li key={world.id}>
                  <button
                    className={selectedWorld?.id === world.id ? "selected" : ""}
                    type="button"
                    onClick={() => setSelectedWorld(world)}
                  >
                    <span>{world.name}</span>
                    {world.isArchived && <small>Archived</small>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No {worldFilter} Worlds.</p>
          )}
        </aside>

        <div className="content-column">
          {selectedWorld ? (
            <>
              <ResourceEditor
                resource={selectedWorld}
                kind="World"
                onSave={saveWorld}
                onArchive={toggleWorldArchive}
              />
              <section
                className="workspace-launch"
                aria-label="World Media Library"
              >
                <div>
                  <p className="eyebrow">Reusable resources</p>
                  <h2>World Media Library</h2>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void navigate(`/worlds/${selectedWorld.id}/media`)
                  }
                >
                  Open World Media
                </button>
              </section>
              <section className="campaigns" aria-label="Campaign browser">
                <div className="section-heading">
                  <h2>Campaigns</h2>
                  <ArchiveSelect
                    value={campaignFilter}
                    onChange={setCampaignFilter}
                  />
                </div>
                {!selectedWorld.isArchived && (
                  <form
                    className="quick-create"
                    onSubmit={(event) => void addCampaign(event)}
                  >
                    <label>
                      New Campaign name
                      <input
                        value={campaignName}
                        onChange={(event) =>
                          setCampaignName(event.target.value)
                        }
                        maxLength={120}
                        required
                      />
                    </label>
                    <button type="submit">Create Campaign</button>
                  </form>
                )}
                {campaigns.length ? (
                  <ul className="resource-list horizontal">
                    {campaigns.map((campaign) => (
                      <li key={campaign.id}>
                        <button
                          type="button"
                          className={
                            selectedCampaign?.id === campaign.id
                              ? "selected"
                              : ""
                          }
                          onClick={() => setSelectedCampaign(campaign)}
                        >
                          <span>{campaign.name}</span>
                          {campaign.isArchived && <small>Archived</small>}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty">No {campaignFilter} Campaigns.</p>
                )}
              </section>
              {selectedCampaign && (
                <>
                  <ResourceEditor
                    resource={selectedCampaign}
                    kind="Campaign"
                    onSave={saveCampaign}
                    onArchive={toggleCampaignArchive}
                  />
                  <section
                    className="workspace-launch"
                    aria-label="Campaign workspace"
                  >
                    <div>
                      <p className="eyebrow">Persistent workspace</p>
                      <h2>Continue {selectedCampaign.name}</h2>
                      <p>
                        Reopen your Entry windows exactly where you left them.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void navigate(
                          `/campaigns/${selectedCampaign.id}/workspace`,
                        )
                      }
                    >
                      Open Campaign Workspace
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() =>
                        void navigate(`/campaigns/${selectedCampaign.id}/media`)
                      }
                    >
                      Open Campaign Media
                    </button>
                  </section>
                </>
              )}
              {!selectedCampaign && (
                <EntryManager
                  world={selectedWorld}
                  campaign={null}
                  onError={setError}
                />
              )}
            </>
          ) : (
            <section className="welcome">
              <p className="eyebrow">Your campaign library</p>
              <h2>Select a World or create your first one.</h2>
              <p>
                Campaigns stay inside their World while preserving their own
                archive state.
              </p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<CampaignLibrary />} />
      <Route
        path="/campaigns/:campaignId/workspace"
        element={<CampaignWorkspace />}
      />
      <Route path="/worlds/:worldId/media" element={<MediaLibrary />} />
      <Route path="/campaigns/:campaignId/media" element={<MediaLibrary />} />
      <Route path="*" element={<CampaignLibrary />} />
    </Routes>
  );
}
