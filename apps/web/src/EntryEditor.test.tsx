import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Entry, EntrySaveInput } from "./api.js";
import { EntryEditor } from "./EntryEditor.js";

const entry: Entry = {
  id: "0198a5d0-3d4a-7000-8000-000000000030",
  type: "QUEST",
  title: "The Lost Crown",
  document: { type: "doc", content: [{ type: "paragraph" }] },
  documentVersion: 2,
  scope: { kind: "world", id: "0198a5d0-3d4a-7000-8000-000000000001" },
  isArchived: false,
  createdAt: "2026-08-13T00:00:00.000Z",
  updatedAt: "2026-08-13T00:00:00.000Z",
  sections: [],
  specialization: { type: "QUEST", status: null, objectives: [] },
};

describe("EntryEditor structured sections", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps section and objective edits in the explicit atomic Save", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: ["Active"] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
    const user = userEvent.setup();
    const onSave = vi.fn<(input: EntrySaveInput) => Promise<void>>(() =>
      Promise.resolve(),
    );
    const onDirtyChange = vi.fn();
    render(
      <EntryEditor
        entry={entry}
        onSave={onSave}
        onArchive={vi.fn()}
        onSearchEntries={vi.fn(() => Promise.resolve([]))}
        onCreateLinkedEntry={vi.fn()}
        onOpenEntryId={vi.fn()}
        onError={vi.fn()}
        onDirtyChange={onDirtyChange}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("Add section"),
      "objectives",
    );
    await user.click(screen.getByRole("button", { name: "Add objective" }));
    await user.clear(screen.getByLabelText("Objective 1"));
    await user.type(screen.getByLabelText("Objective 1"), "Recover the crown");
    await user.click(screen.getByRole("button", { name: "Save Entry" }));

    expect(onDirtyChange).toHaveBeenCalledWith(true);
    const saved = onSave.mock.calls[0]?.[0];
    expect(saved?.sections).toEqual(["objectives"]);
    expect(saved?.specialization.type).toBe("QUEST");
    if (saved?.specialization.type !== "QUEST")
      throw new Error("Expected Quest specialization");
    expect(saved.specialization.objectives[0]).toMatchObject({
      text: "Recover the crown",
      completed: false,
    });
  });
});
