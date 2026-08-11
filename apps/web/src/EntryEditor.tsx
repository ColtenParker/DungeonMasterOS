import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { FormEvent, useEffect, useState } from "react";

import type { Entry, EntryType } from "./api.js";
import { entryLinkMark } from "./entry-document.js";

const extensions = [
  StarterKit.configure({
    horizontalRule: false,
    link: false,
    underline: false,
  }),
  entryLinkMark,
];

interface EntryEditorProps {
  entry: Entry;
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

export function EntryEditor({
  entry,
  onSave,
  onArchive,
  onSearchEntries,
  onCreateLinkedEntry,
  onOpenEntryId,
  onError,
}: EntryEditorProps) {
  const [title, setTitle] = useState(entry.title);
  const [saving, setSaving] = useState(false);
  const [linkRange, setLinkRange] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkQuery, setLinkQuery] = useState("");
  const [linkResults, setLinkResults] = useState<Entry[]>([]);
  const [linkType, setLinkType] = useState<EntryType>("NPC");
  const [linkScope, setLinkScope] = useState<"world" | "campaign">(
    entry.scope.kind,
  );
  const editor = useEditor({
    extensions,
    content: entry.document,
    immediatelyRender: false,
    editorProps: {
      handleClick(view, position) {
        const marks = [
          ...(view.state.doc.nodeAt(position)?.marks ?? []),
          ...view.state.doc.resolve(position).marks(),
        ];
        const link = marks.find((mark) => mark.type.name === "entryLink");
        if (typeof link?.attrs.entryId === "string") {
          onOpenEntryId(link.attrs.entryId);
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    setTitle(entry.title);
    editor?.commands.setContent(entry.document);
    setLinkRange(null);
    setLinkResults([]);
    setLinkScope(entry.scope.kind);
  }, [editor, entry]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    try {
      await onSave({ title, document: editor.getJSON() });
    } finally {
      setSaving(false);
    }
  }

  function beginEntryLink() {
    if (!editor || editor.state.selection.empty) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    setLinkRange({ from, to });
    setLinkTitle(selectedText);
    setLinkQuery(selectedText);
    setLinkResults([]);
  }

  async function findEntry() {
    if (!linkQuery.trim()) return;
    try {
      setLinkResults(
        (await onSearchEntries(linkQuery)).filter(
          (candidate) => candidate.id !== entry.id,
        ),
      );
    } catch (reason) {
      onError(
        reason instanceof Error
          ? reason.message
          : "Could not search Entries to link.",
      );
    }
  }

  function applyEntryLink(target: Entry) {
    if (!editor || !linkRange) return;
    editor
      .chain()
      .focus()
      .setTextSelection(linkRange)
      .setMark("entryLink", { entryId: target.id })
      .run();
    setLinkRange(null);
    setLinkResults([]);
  }

  async function createLinkedEntry() {
    if (!linkTitle.trim()) return;
    try {
      applyEntryLink(
        await onCreateLinkedEntry({
          type: linkType,
          title: linkTitle,
          scope: linkScope,
        }),
      );
    } catch (reason) {
      onError(
        reason instanceof Error
          ? reason.message
          : "Could not create the linked Entry.",
      );
    }
  }

  return (
    <section className="editor entry-editor" aria-label="Entry details">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{entry.type.toLowerCase()}</p>
          <h2>{entry.title}</h2>
          <small className="scope-label">
            {entry.scope.kind === "world" ? "World" : "Campaign"} scope
          </small>
        </div>
        <button
          className="secondary danger"
          type="button"
          onClick={() => void onArchive()}
        >
          {entry.isArchived ? "Restore Entry" : "Archive Entry"}
        </button>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <label>
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            required
          />
        </label>
        <div className="document-field">
          <span className="document-label">Document</span>
          <div
            className="editor-toolbar"
            role="toolbar"
            aria-label="Document formatting"
          >
            <button
              type="button"
              className="secondary"
              aria-label="Bold"
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              B
            </button>
            <button
              type="button"
              className="secondary"
              aria-label="Italic"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              I
            </button>
            <button
              type="button"
              className="secondary"
              aria-label="Heading"
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              H2
            </button>
            <button
              type="button"
              className="secondary"
              aria-label="Bullet list"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              List
            </button>
            <button
              type="button"
              className="secondary"
              aria-label="Block quote"
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            >
              Quote
            </button>
            <button
              type="button"
              className="secondary"
              aria-label="Code block"
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            >
              Code
            </button>
            <button
              type="button"
              className="secondary"
              aria-label="Link highlighted text to Entry"
              onClick={beginEntryLink}
            >
              Link Entry
            </button>
            <button
              type="button"
              className="secondary"
              aria-label="Remove Entry link"
              onClick={() =>
                editor?.chain().focus().unsetMark("entryLink").run()
              }
            >
              Unlink
            </button>
          </div>
          <EditorContent editor={editor} className="rich-document" />
        </div>
        {linkRange && (
          <div className="link-picker" aria-label="Link highlighted text">
            <div className="section-heading">
              <h3>Link “{linkTitle}”</h3>
              <button
                className="secondary"
                type="button"
                onClick={() => setLinkRange(null)}
              >
                Cancel
              </button>
            </div>
            <div className="inline-form">
              <label>
                Find existing Entry
                <input
                  value={linkQuery}
                  onChange={(event) => setLinkQuery(event.target.value)}
                  maxLength={200}
                />
              </label>
              <button type="button" onClick={() => void findEntry()}>
                Find
              </button>
            </div>
            <ul className="knowledge-list search-results">
              {linkResults.map((result) => (
                <li key={result.id}>
                  <button type="button" onClick={() => applyEntryLink(result)}>
                    Link {result.title}
                  </button>
                  <small>
                    {result.scope.kind === "world" ? "World" : "Campaign"}
                  </small>
                </li>
              ))}
            </ul>
            <div className="entry-create">
              <label>
                New Entry title
                <input
                  value={linkTitle}
                  onChange={(event) => setLinkTitle(event.target.value)}
                  maxLength={120}
                  required
                />
              </label>
              <label>
                Type
                <select
                  value={linkType}
                  onChange={(event) =>
                    setLinkType(event.target.value as EntryType)
                  }
                >
                  <option value="NPC">NPC</option>
                  <option value="LOCATION">Location</option>
                  <option value="JOURNAL">Journal</option>
                </select>
              </label>
              {entry.scope.kind === "campaign" && (
                <label>
                  Scope
                  <select
                    value={linkScope}
                    onChange={(event) =>
                      setLinkScope(event.target.value as "world" | "campaign")
                    }
                  >
                    <option value="campaign">Campaign</option>
                    <option value="world">World</option>
                  </select>
                </label>
              )}
              <button type="button" onClick={() => void createLinkedEntry()}>
                Create and Link
              </button>
            </div>
            <p className="field-help">
              The link is saved when you save this Entry.
            </p>
          </div>
        )}
        <button type="submit" disabled={saving || !editor}>
          {saving ? "Saving…" : "Save Entry"}
        </button>
      </form>
    </section>
  );
}
