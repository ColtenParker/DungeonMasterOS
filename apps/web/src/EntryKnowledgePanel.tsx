import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  createEntryRelationship,
  deleteEntryRelationship,
  type Entry,
  type EntryKnowledge,
  type EntrySummary,
  getEntryKnowledge,
  listEntryTags,
  listWorldTags,
  replaceEntryTags,
  type Tag,
} from "./api.js";

interface EntryKnowledgePanelProps {
  entry: Entry;
  worldId: string;
  onSearchEntries: (query: string) => Promise<Entry[]>;
  onOpenEntry: (entry: EntrySummary) => void;
  onError: (message: string) => void;
}

export function EntryKnowledgePanel({
  entry,
  worldId,
  onSearchEntries,
  onOpenEntry,
  onError,
}: EntryKnowledgePanelProps) {
  const [knowledge, setKnowledge] = useState<EntryKnowledge>({
    outgoing: [],
    backlinks: [],
  });
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [relationQuery, setRelationQuery] = useState("");
  const [relationNote, setRelationNote] = useState("");
  const [relationResults, setRelationResults] = useState<Entry[]>([]);

  const refresh = useCallback(async () => {
    const [nextKnowledge, nextTags, suggestions] = await Promise.all([
      getEntryKnowledge(entry.id),
      listEntryTags(entry.id),
      listWorldTags(worldId),
    ]);
    setKnowledge(nextKnowledge);
    setTags(nextTags.items);
    setTagSuggestions(suggestions.items);
  }, [entry.id, worldId]);

  useEffect(() => {
    refresh().catch((reason: unknown) =>
      onError(
        reason instanceof Error
          ? reason.message
          : "Could not load Entry connections.",
      ),
    );
  }, [onError, refresh]);

  async function saveTags(names: string[]) {
    try {
      const result = await replaceEntryTags(entry.id, names);
      setTags(result.items);
      setTagInput("");
      const suggestions = await listWorldTags(worldId);
      setTagSuggestions(suggestions.items);
    } catch (reason) {
      onError(
        reason instanceof Error ? reason.message : "Could not save tags.",
      );
    }
  }

  async function findRelationshipTarget(event: FormEvent) {
    event.preventDefault();
    if (!relationQuery.trim()) return;
    try {
      const results = await onSearchEntries(relationQuery);
      setRelationResults(results.filter((result) => result.id !== entry.id));
    } catch (reason) {
      onError(
        reason instanceof Error
          ? reason.message
          : "Could not search related Entries.",
      );
    }
  }

  async function addRelationship(target: Entry) {
    try {
      await createEntryRelationship(entry.id, {
        targetEntryId: target.id,
        contextNote: relationNote || null,
      });
      setRelationQuery("");
      setRelationNote("");
      setRelationResults([]);
      await refresh();
    } catch (reason) {
      onError(
        reason instanceof Error
          ? reason.message
          : "Could not create relationship.",
      );
    }
  }

  return (
    <section className="entry-knowledge" aria-label="Entry knowledge">
      <div className="knowledge-column">
        <h3>Tags</h3>
        <div className="tag-list">
          {tags.map((tag) => (
            <button
              className="tag"
              type="button"
              key={tag.id}
              aria-label={`Remove ${tag.name} tag`}
              onClick={() =>
                void saveTags(
                  tags
                    .filter((candidate) => candidate.id !== tag.id)
                    .map(({ name }) => name),
                )
              }
            >
              {tag.name} ×
            </button>
          ))}
        </div>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (tagInput.trim()) {
              void saveTags([...tags.map(({ name }) => name), tagInput]);
            }
          }}
        >
          <label>
            Add tag
            <input
              list={`tag-suggestions-${entry.id}`}
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              maxLength={50}
            />
            <datalist id={`tag-suggestions-${entry.id}`}>
              {tagSuggestions.map((tag) => (
                <option value={tag.name} key={tag.id} />
              ))}
            </datalist>
          </label>
          <button type="submit">Add</button>
        </form>
      </div>

      <div className="knowledge-column">
        <h3>Related Entries</h3>
        <ul className="knowledge-list">
          {knowledge.outgoing.map((relationship) => (
            <li key={relationship.id}>
              <button
                type="button"
                onClick={() => onOpenEntry(relationship.target)}
              >
                {relationship.target.title}
              </button>
              {relationship.contextNote && (
                <small>{relationship.contextNote}</small>
              )}
              <button
                className="secondary danger compact"
                type="button"
                onClick={() =>
                  void deleteEntryRelationship(entry.id, relationship.id)
                    .then(refresh)
                    .catch((reason: unknown) =>
                      onError(
                        reason instanceof Error
                          ? reason.message
                          : "Could not remove relationship.",
                      ),
                    )
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form
          className="relationship-form"
          onSubmit={(event) => void findRelationshipTarget(event)}
        >
          <label>
            Find Entry
            <input
              value={relationQuery}
              onChange={(event) => setRelationQuery(event.target.value)}
              maxLength={200}
            />
          </label>
          <label>
            Context note (optional)
            <input
              value={relationNote}
              onChange={(event) => setRelationNote(event.target.value)}
              maxLength={1000}
            />
          </label>
          <button type="submit">Find</button>
        </form>
        <ul className="knowledge-list search-results">
          {relationResults.map((result) => (
            <li key={result.id}>
              <button
                type="button"
                onClick={() => void addRelationship(result)}
              >
                Add {result.title}
              </button>
              <small>
                {result.scope.kind === "world" ? "World" : "Campaign"}
              </small>
            </li>
          ))}
        </ul>
      </div>

      <div className="knowledge-column">
        <h3>Backlinks</h3>
        <ul className="knowledge-list">
          {knowledge.backlinks.map((backlink, index) => (
            <li key={`${backlink.kind}-${backlink.source.id}-${index}`}>
              <button
                type="button"
                onClick={() => onOpenEntry(backlink.source)}
              >
                {backlink.source.title}
              </button>
              <small>
                {backlink.kind === "inline"
                  ? "Inline mention"
                  : backlink.kind === "specialized"
                    ? backlink.label
                    : "Relationship"}
                {backlink.source.isArchived ? " · Archived" : ""}
              </small>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
