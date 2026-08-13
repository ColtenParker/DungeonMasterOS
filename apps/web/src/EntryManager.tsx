import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  type ArchiveFilter,
  type Campaign,
  createCampaignEntry,
  createWorldEntry,
  type Entry,
  type EntrySaveInput,
  type EntrySummary,
  type EntryType,
  getEntry,
  listWorldTags,
  listCampaignEntries,
  listWorldEntries,
  searchCampaignEntries,
  searchWorldEntries,
  type Tag,
  updateEntry,
  type World,
} from "./api.js";
import { EntryEditor } from "./EntryEditor.js";
import { EntryKnowledgePanel } from "./EntryKnowledgePanel.js";
import { QuickOpen } from "./QuickOpen.js";

const typeLabels: Record<EntryType, string> = {
  NPC: "NPC",
  LOCATION: "Location",
  JOURNAL: "Journal",
  QUEST: "Quest",
  FACTION: "Faction",
  ITEM: "Item",
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
  const [newPreset, setNewPreset] = useState("blank");
  const [searchText, setSearchText] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [newScope, setNewScope] = useState<"campaign" | "world">(
    campaign ? "campaign" : "world",
  );

  const refresh = useCallback(async () => {
    const selectedType = type === "all" ? undefined : type;
    const searchInput = {
      archive,
      ...(activeQuery ? { query: activeQuery } : {}),
      ...(selectedType ? { type: selectedType } : {}),
      ...(tagFilter ? { tag: tagFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    };
    const result =
      activeQuery || tagFilter
        ? campaign
          ? await searchCampaignEntries(campaign.id, searchInput)
          : await searchWorldEntries(world.id, searchInput)
        : campaign
          ? await listCampaignEntries(
              campaign.id,
              archive,
              selectedType,
              statusFilter,
            )
          : await listWorldEntries(
              world.id,
              archive,
              selectedType,
              statusFilter,
            );
    setEntries(result.items);
  }, [activeQuery, archive, campaign, statusFilter, tagFilter, type, world.id]);

  useEffect(() => {
    setSelectedEntry(null);
    setNewScope(campaign ? "campaign" : "world");
    setSearchText("");
    setActiveQuery("");
    setTagFilter("");
  }, [campaign, world.id]);

  useEffect(() => {
    listWorldTags(world.id)
      .then((result) => setAvailableTags(result.items))
      .catch((reason: unknown) =>
        onError(
          reason instanceof Error ? reason.message : "Could not load tags.",
        ),
      );
  }, [onError, world.id]);

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
            preset: newPreset,
          })
        : await createWorldEntry(world.id, {
            type: newType,
            title: newTitle,
            preset: newPreset,
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

  async function save(input: EntrySaveInput) {
    if (!selectedEntry) return;
    try {
      const updated = await updateEntry(selectedEntry.id, input);
      setSelectedEntry(updated);
      await refresh();
    } catch (reason) {
      onError(
        reason instanceof Error ? reason.message : "Could not save Entry.",
      );
      throw reason;
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

  async function searchForSelectedEntry(query: string) {
    if (!selectedEntry) return [];
    const result =
      selectedEntry.scope.kind === "campaign"
        ? await searchCampaignEntries(selectedEntry.scope.id, {
            query,
            archive: "all",
            limit: 20,
          })
        : await searchWorldEntries(selectedEntry.scope.id, {
            query,
            archive: "all",
            limit: 20,
          });
    return result.items;
  }

  async function createLinkedEntry(input: {
    type: EntryType;
    title: string;
    scope: "world" | "campaign";
  }) {
    if (!selectedEntry) throw new Error("No source Entry is open.");
    const created =
      selectedEntry.scope.kind === "campaign"
        ? await createCampaignEntry(selectedEntry.scope.id, input)
        : await createWorldEntry(selectedEntry.scope.id, {
            type: input.type,
            title: input.title,
          });
    await refresh();
    return created;
  }

  async function openEntry(summary: Pick<EntrySummary, "id">) {
    try {
      setSelectedEntry(await getEntry(summary.id));
    } catch (reason) {
      onError(
        reason instanceof Error ? reason.message : "Could not open Entry.",
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
            <QuickOpen
              world={world}
              campaign={campaign}
              onOpen={setSelectedEntry}
              onError={onError}
            />
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
                <option value="QUEST">Quests</option>
                <option value="FACTION">Factions</option>
                <option value="ITEM">Items</option>
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
            <label className="filter">
              Status
              <input
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                maxLength={80}
                placeholder="Any"
              />
            </label>
            <label className="filter">
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
        </div>
        <form
          className="entry-search"
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
        {!parentArchived && (
          <form
            className="entry-create"
            onSubmit={(event) => void create(event)}
          >
            <label>
              Entry type
              <select
                value={newType}
                onChange={(event) => {
                  setNewType(event.target.value as EntryType);
                  setNewPreset("blank");
                }}
              >
                <option value="NPC">NPC</option>
                <option value="LOCATION">Location</option>
                <option value="JOURNAL">Journal</option>
                <option value="QUEST">Quest</option>
                <option value="FACTION">Faction</option>
                <option value="ITEM">Item</option>
              </select>
            </label>
            {newType === "NPC" && (
              <label>
                Preset
                <select
                  value={newPreset}
                  onChange={(event) => setNewPreset(event.target.value)}
                >
                  <option value="blank">Blank</option>
                  <option value="merchant">Merchant</option>
                  <option value="noble">Noble</option>
                  <option value="guard">Guard</option>
                  <option value="villain">Villain</option>
                </select>
              </label>
            )}
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
          onSearchEntries={searchForSelectedEntry}
          onCreateLinkedEntry={createLinkedEntry}
          onOpenEntryId={(entryId) => void openEntry({ id: entryId })}
          onError={onError}
        />
      )}
      {selectedEntry && (
        <EntryKnowledgePanel
          entry={selectedEntry}
          worldId={world.id}
          onSearchEntries={searchForSelectedEntry}
          onOpenEntry={(entry) => void openEntry(entry)}
          onError={onError}
        />
      )}
    </>
  );
}
