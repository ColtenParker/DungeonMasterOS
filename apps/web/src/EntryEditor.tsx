import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { FormEvent, useEffect, useState } from "react";

import type { Entry } from "./api.js";

const extensions = [
  StarterKit.configure({
    horizontalRule: false,
    link: false,
    underline: false,
  }),
];

interface EntryEditorProps {
  entry: Entry;
  onSave: (input: Pick<Entry, "title" | "document">) => Promise<void>;
  onArchive: () => Promise<void>;
}

export function EntryEditor({ entry, onSave, onArchive }: EntryEditorProps) {
  const [title, setTitle] = useState(entry.title);
  const [saving, setSaving] = useState(false);
  const editor = useEditor({
    extensions,
    content: entry.document,
    immediatelyRender: false,
  });

  useEffect(() => {
    setTitle(entry.title);
    editor?.commands.setContent(entry.document);
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
          </div>
          <EditorContent editor={editor} className="rich-document" />
        </div>
        <button type="submit" disabled={saving || !editor}>
          {saving ? "Saving…" : "Save Entry"}
        </button>
      </form>
    </section>
  );
}
