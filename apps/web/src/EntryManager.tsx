import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  type ArchiveFilter,
  type Campaign,
  createCampaignEntry,
  createWorldEntry,
  type Entry,
  type EntryType,
  listCampaignEntries,
  listWorldEntries,
  updateEntry,
  type World,
} from "./api.js";
import { EntryEditor } from "./EntryEditor.js";

const typeLabels: Record<EntryType, string> = {
  NPC: "NPC",
  LOCATION: "Location",
  JOURNAL: "Journal",
};

interface EntryManagerProps {
  world: World;
  campaign: Campaign | null;
  onError: (message: string) => void;
}

export function EntryManager({ world, campaign, onError }: EntryManagerProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [archive, setArchive] = useState<ArchiveFilter>("active");
  const [type, setType] = useState<EntryType | "all">("all");
  const [newType, setNewType] = useState<EntryType>("NPC");
  const [newTitle, setNewTitle] = useState("");
  const [newScope, setNewScope] = useState<"campaign" | "world">(
    campaign ? "campaign" : "world",
  );

  const refresh = useCallback(async () => {
    const selectedType = type === "all" ? undefined : type;
    const result = campaign
      ? await listCampaignEntries(campaign.id, archive, selectedType)
      : await listWorldEntries(world.id, archive, selectedType);
    setEntries(result.items);
  }, [archive, campaign, type, world.id]);

  useEffect(() => {
    setSelectedEntry(null);
    setNewScope(campaign ? "campaign" : "world");
  }, [campaign, world.id]);

  useEffect(() => {
    refresh().catch((reason: unknown) =>
      onError(
        reason instanceof Error ? reason.message : "Could not load Entries.",
      ),
    );
  }, [onError, refresh]);

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      const created = campaign
        ? await createCampaignEntry(campaign.id, {
            type: newType,
            title: newTitle,
            scope: newScope,
          })
        : await createWorldEntry(world.id, {
            type: newType,
            title: newTitle,
          });
      setNewTitle("");
      setSelectedEntry(created);
      await refresh();
    } catch (reason) {
      onError(
        reason instanceof Error ? reason.message : "Could not create Entry.",
      );
    }
  }

  async function save(input: Pick<Entry, "title" | "document">) {
    if (!selectedEntry) return;
    try {
      const updated = await updateEntry(selectedEntry.id, input);
      setSelectedEntry(updated);
      await refresh();
    } catch (reason) {
      onError(
        reason instanceof Error ? reason.message : "Could not save Entry.",
      );
    }
  }

  async function toggleArchive() {
    if (!selectedEntry) return;
    try {
      await updateEntry(selectedEntry.id, {
        isArchived: !selectedEntry.isArchived,
      });
      setSelectedEntry(null);
      await refresh();
    } catch (reason) {
      onError(
        reason instanceof Error ? reason.message : "Could not update Entry.",
      );
    }
  }

  const parentArchived = world.isArchived || Boolean(campaign?.isArchived);

  return (
    <>
      <section className="entries" aria-label="Entry browser">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Notebook</p>
            <h2>
              {campaign ? `${campaign.name} Entries` : `${world.name} Entries`}
            </h2>
          </div>
          <div className="entry-filters">
            <label className="filter">
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
            <label className="filter">
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
        </div>
        {!parentArchived && (
          <form
            className="entry-create"
            onSubmit={(event) => void create(event)}
          >
            <label>
              Entry type
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
            <label className="entry-title-field">
              New Entry title
              <input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                maxLength={120}
                required
              />
            </label>
            {campaign && (
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
            )}
            <button type="submit">Create Entry</button>
          </form>
        )}
        {entries.length ? (
          <ul className="resource-list horizontal entry-list">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={selectedEntry?.id === entry.id ? "selected" : ""}
                  onClick={() => setSelectedEntry(entry)}
                >
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
      </section>
      {selectedEntry && (
        <EntryEditor
          entry={selectedEntry}
          onSave={save}
          onArchive={toggleArchive}
        />
      )}
    </>
  );
}
