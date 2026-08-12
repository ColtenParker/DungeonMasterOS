import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import {
  type ArchiveFilter,
  type Campaign,
  deleteMedia,
  getCampaign,
  getWorld,
  importCampaignMedia,
  importWorldMedia,
  listCampaignMedia,
  listWorldMedia,
  type Media,
  type MediaType,
  updateMedia,
  type World,
} from "./api.js";

export function MediaLibrary() {
  const { worldId, campaignId } = useParams();
  const navigate = useNavigate();
  const [world, setWorld] = useState<World | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [items, setItems] = useState<Media[]>([]);
  const [selected, setSelected] = useState<Media | null>(null);
  const [archive, setArchive] = useState<ArchiveFilter>("active");
  const [type, setType] = useState<MediaType | "all">("all");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [importType, setImportType] = useState<MediaType>("IMAGE");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const selectedType = type === "all" ? undefined : type;
    const result = campaignId
      ? await listCampaignMedia(campaignId, archive, selectedType)
      : await listWorldMedia(worldId!, archive, selectedType);
    setItems(result.items);
    setSelected((current) =>
      current
        ? (result.items.find(({ id }) => id === current.id) ?? null)
        : null,
    );
  }, [archive, campaignId, type, worldId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const loadContext = async () => {
      if (campaignId) {
        const nextCampaign = await getCampaign(campaignId);
        const nextWorld = await getWorld(nextCampaign.worldId);
        if (active) {
          setCampaign(nextCampaign);
          setWorld(nextWorld);
        }
      } else if (worldId) {
        const nextWorld = await getWorld(worldId);
        if (active) setWorld(nextWorld);
      } else {
        throw new Error(
          "A World or Campaign is required for the Media Library.",
        );
      }
      await refresh();
    };
    loadContext()
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load the Media Library.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [campaignId, refresh, worldId]);

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setDescription(selected.description ?? "");
  }, [selected]);

  async function importImage(event: FormEvent) {
    event.preventDefault();
    if (!file || (!campaignId && !worldId)) return;
    setBusy(true);
    setError(null);
    try {
      const created = campaignId
        ? await importCampaignMedia(campaignId, {
            name,
            description,
            type: importType,
            file,
          })
        : await importWorldMedia(worldId!, {
            name,
            description,
            type: importType,
            file,
          });
      setName("");
      setDescription("");
      setFile(null);
      await refresh();
      setSelected(created);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not import Media.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveSelected(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await updateMedia(selected.id, {
        name,
        description: description || null,
      });
      await refresh();
      setSelected(updated);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not update Media.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive() {
    if (!selected) return;
    setBusy(true);
    try {
      await updateMedia(selected.id, { isArchived: !selected.isArchived });
      setSelected(null);
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not update Media.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function permanentlyDelete() {
    if (!selected || !window.confirm(`Permanently delete ${selected.name}?`))
      return;
    setBusy(true);
    try {
      await deleteMedia(selected.id);
      setSelected(null);
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not delete Media.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="workspace-loading">
        <p role="status">Loading Media Library…</p>
      </main>
    );
  }

  return (
    <main className="media-library">
      <header className="app-header">
        <div>
          <p className="eyebrow">
            {campaign ? "Campaign Media" : "World Media"}
          </p>
          <h1>{campaign?.name ?? world?.name ?? "Media Library"}</h1>
          {campaign && <small>{world?.name}</small>}
        </div>
        <button
          className="secondary"
          type="button"
          onClick={() => void navigate(-1)}
        >
          Back
        </button>
      </header>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <div className="media-library-layout">
        <aside className="media-browser" aria-label="Media browser">
          <div className="workspace-filters">
            <label>
              Type
              <select
                value={type}
                onChange={(event) =>
                  setType(event.target.value as MediaType | "all")
                }
              >
                <option value="all">All</option>
                <option value="IMAGE">Images</option>
                <option value="MAP">Maps</option>
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
          </div>
          {items.length ? (
            <ul className="media-grid">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={selected?.id === item.id ? "selected" : ""}
                    onClick={() => setSelected(item)}
                  >
                    {item.isAvailable ? (
                      <img src={item.urls.thumbnail} alt="" />
                    ) : (
                      <span className="broken-media">Unavailable</span>
                    )}
                    <strong>{item.name}</strong>
                    <small>
                      {item.type === "MAP" ? "Map" : "Image"}
                      {item.isArchived ? " · Archived" : ""}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No matching Media.</p>
          )}
        </aside>

        <div className="media-details">
          {selected ? (
            <section className="editor" aria-label="Media details">
              {selected.isAvailable ? (
                <img
                  className="media-preview"
                  src={selected.urls.display}
                  alt={selected.name}
                />
              ) : (
                <div className="broken-media" role="status">
                  Managed image files are unavailable.
                </div>
              )}
              <form onSubmit={(event) => void saveSelected(event)}>
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
                    rows={4}
                  />
                </label>
                <p className="media-metadata">
                  {selected.width} × {selected.height} ·{" "}
                  {(selected.byteSize / 1024 / 1024).toFixed(1)} MiB ·{" "}
                  {selected.scope.kind === "world" ? "World" : "Campaign"}
                </p>
                <div className="confirmation-actions">
                  <button type="submit" disabled={busy}>
                    Save Media
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleArchive()}
                  >
                    {selected.isArchived ? "Restore" : "Archive"}
                  </button>
                  <button
                    className="secondary danger"
                    type="button"
                    disabled={busy}
                    onClick={() => void permanentlyDelete()}
                  >
                    Delete permanently
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <section className="editor" aria-label="Import Media">
              <p className="eyebrow">New resource</p>
              <h2>Import an image or map</h2>
              <form onSubmit={(event) => void importImage(event)}>
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
                    rows={3}
                  />
                </label>
                <label>
                  Classification
                  <select
                    value={importType}
                    onChange={(event) =>
                      setImportType(event.target.value as MediaType)
                    }
                  >
                    <option value="IMAGE">Image</option>
                    <option value="MAP">Map</option>
                  </select>
                </label>
                <label>
                  PNG, JPEG, or WebP
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) =>
                      setFile(event.target.files?.[0] ?? null)
                    }
                    required
                  />
                </label>
                <button type="submit" disabled={busy || !file}>
                  {busy ? "Importing…" : "Import Media"}
                </button>
              </form>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
