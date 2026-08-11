import { FormEvent, useEffect, useRef, useState } from "react";

import {
  type Campaign,
  type Entry,
  searchAllEntries,
  searchCampaignEntries,
  searchWorldEntries,
  type World,
} from "./api.js";

interface QuickOpenProps {
  world: World;
  campaign: Campaign | null;
  onOpen: (entry: Entry) => void;
  onError: (message: string) => void;
}

export function QuickOpen({
  world,
  campaign,
  onOpen,
  onError,
}: QuickOpenProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"context" | "global">("context");
  const [results, setResults] = useState<Entry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    try {
      const result =
        scope === "global"
          ? await searchAllEntries({ query, limit: 50 })
          : campaign
            ? await searchCampaignEntries(campaign.id, { query, limit: 50 })
            : await searchWorldEntries(world.id, { query, limit: 50 });
      setResults(result.items);
    } catch (reason) {
      onError(
        reason instanceof Error ? reason.message : "Could not search Entries.",
      );
    }
  }

  return (
    <>
      <button className="secondary" type="button" onClick={() => setOpen(true)}>
        Quick Open <kbd>Ctrl K</kbd>
      </button>
      {open && (
        <section className="quick-open" role="dialog" aria-label="Quick Open">
          <div className="section-heading">
            <h2>Quick Open</h2>
            <button
              className="secondary"
              type="button"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
          <form onSubmit={(event) => void search(event)}>
            <label>
              Find an Entry
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={200}
              />
            </label>
            <label>
              Search scope
              <select
                value={scope}
                onChange={(event) =>
                  setScope(event.target.value as "context" | "global")
                }
              >
                <option value="context">
                  {campaign ? "Current Campaign" : "Current World"}
                </option>
                <option value="global">Global</option>
              </select>
            </label>
            <button type="submit">Search</button>
          </form>
          <ul className="resource-list horizontal search-results">
            {results.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => {
                    onOpen(entry);
                    setOpen(false);
                  }}
                >
                  <span>
                    <strong>{entry.title}</strong>
                    <small>{entry.type}</small>
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
        </section>
      )}
    </>
  );
}
