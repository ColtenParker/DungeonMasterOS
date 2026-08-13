import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  FormEvent,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import {
  listCampaignMedia,
  listEntryStatuses,
  listWorldMedia,
  type Entry,
  type EntrySaveInput,
  type EntrySpecialization,
  type EntryType,
  type Media,
} from "./api.js";
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
  onSave: (input: EntrySaveInput) => Promise<void>;
  onArchive: () => Promise<void>;
  onSearchEntries: (query: string) => Promise<Entry[]>;
  onCreateLinkedEntry: (input: {
    type: EntryType;
    title: string;
    scope: "world" | "campaign";
  }) => Promise<Entry>;
  onOpenEntryId: (entryId: string) => void;
  onError: (message: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export interface EntryEditorHandle {
  save: () => Promise<void>;
}

export const EntryEditor = forwardRef<EntryEditorHandle, EntryEditorProps>(
  function EntryEditor(
    {
      entry,
      onSave,
      onArchive,
      onSearchEntries,
      onCreateLinkedEntry,
      onOpenEntryId,
      onError,
      onDirtyChange,
    },
    ref,
  ) {
    const [title, setTitle] = useState(entry.title);
    const [baselineTitle, setBaselineTitle] = useState(entry.title);
    const initialDocumentSignature = JSON.stringify(entry.document);
    const [documentSignature, setDocumentSignature] = useState(
      initialDocumentSignature,
    );
    const [baselineDocumentSignature, setBaselineDocumentSignature] = useState(
      initialDocumentSignature,
    );
    const [saving, setSaving] = useState(false);
    const [sections, setSections] = useState([...entry.sections]);
    const [specialization, setSpecialization] = useState<EntrySpecialization>(
      structuredClone(entry.specialization),
    );
    const [baselineStructuredSignature, setBaselineStructuredSignature] =
      useState(JSON.stringify([entry.sections, entry.specialization]));
    const [images, setImages] = useState<Media[]>([]);
    const [statusSuggestions, setStatusSuggestions] = useState<string[]>([]);
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
    const loadedEntryId = useRef<string | null>(null);
    const editor = useEditor({
      extensions,
      content: entry.document,
      immediatelyRender: false,
      onUpdate({ editor: currentEditor }) {
        setDocumentSignature(JSON.stringify(currentEditor.getJSON()));
      },
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
      if (loadedEntryId.current === entry.id) return;
      loadedEntryId.current = entry.id;
      const signature = JSON.stringify(entry.document);
      setTitle(entry.title);
      setBaselineTitle(entry.title);
      setDocumentSignature(signature);
      setBaselineDocumentSignature(signature);
      editor?.commands.setContent(entry.document);
      setLinkRange(null);
      setLinkResults([]);
      setLinkScope(entry.scope.kind);
      setSections([...entry.sections]);
      setSpecialization(structuredClone(entry.specialization));
      setBaselineStructuredSignature(
        JSON.stringify([entry.sections, entry.specialization]),
      );
    }, [editor, entry]);

    useEffect(() => {
      if (entry.type !== "NPC") return;
      const request =
        entry.scope.kind === "world"
          ? listWorldMedia(entry.scope.id, "all", "IMAGE")
          : listCampaignMedia(entry.scope.id, "all", "IMAGE");
      void request
        .then(({ items }) => setImages(items))
        .catch(() => setImages([]));
    }, [entry.scope.id, entry.scope.kind, entry.type]);

    useEffect(() => {
      if (
        entry.type !== "NPC" &&
        entry.type !== "QUEST" &&
        entry.type !== "FACTION"
      )
        return;
      void listEntryStatuses(entry.scope, entry.type)
        .then(({ items }) => setStatusSuggestions(items))
        .catch(() => setStatusSuggestions([]));
    }, [entry.scope, entry.type]);

    const isDirty =
      title !== baselineTitle ||
      documentSignature !== baselineDocumentSignature ||
      JSON.stringify([sections, specialization]) !==
        baselineStructuredSignature;

    useEffect(() => {
      onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    async function saveCurrent() {
      if (!editor) return;
      const document = editor.getJSON();
      setSaving(true);
      try {
        await onSave({ title, document, sections, specialization });
        setBaselineTitle(title);
        const signature = JSON.stringify(document);
        setDocumentSignature(signature);
        setBaselineDocumentSignature(signature);
        setBaselineStructuredSignature(
          JSON.stringify([sections, specialization]),
        );
      } finally {
        setSaving(false);
      }
    }

    useImperativeHandle(ref, () => ({ save: saveCurrent }));

    async function submit(event: FormEvent) {
      event.preventDefault();
      await saveCurrent();
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
          <SpecializedSections
            entry={entry}
            sections={sections}
            specialization={specialization}
            images={images}
            statusSuggestions={statusSuggestions}
            onSectionsChange={setSections}
            onSpecializationChange={setSpecialization}
            onSearchEntries={onSearchEntries}
          />
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
                    <button
                      type="button"
                      onClick={() => applyEntryLink(result)}
                    >
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
                    <option value="QUEST">Quest</option>
                    <option value="FACTION">Faction</option>
                    <option value="ITEM">Item</option>
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
  },
);

const sectionOptions: Partial<
  Record<EntryType, Array<{ key: string; label: string }>>
> = {
  NPC: [
    { key: "portrait", label: "Portrait" },
    { key: "status", label: "Status" },
    { key: "currentLocation", label: "Current location" },
    { key: "inventory", label: "Inventory" },
  ],
  LOCATION: [
    { key: "hierarchy", label: "Hierarchy" },
    { key: "inventory", label: "Inventory" },
  ],
  QUEST: [
    { key: "status", label: "Status" },
    { key: "objectives", label: "Objectives" },
  ],
  FACTION: [
    { key: "status", label: "Status" },
    { key: "leadership", label: "Leadership" },
  ],
};

function SpecializedSections({
  entry,
  sections,
  specialization,
  images,
  statusSuggestions,
  onSectionsChange,
  onSpecializationChange,
  onSearchEntries,
}: {
  entry: Entry;
  sections: string[];
  specialization: EntrySpecialization;
  images: Media[];
  statusSuggestions: string[];
  onSectionsChange: (value: string[]) => void;
  onSpecializationChange: (value: EntrySpecialization) => void;
  onSearchEntries: (query: string) => Promise<Entry[]>;
}) {
  const options = sectionOptions[entry.type] ?? [];
  const available = options.filter(({ key }) => !sections.includes(key));
  function remove(key: string) {
    if (
      !window.confirm(
        `Remove the ${options.find((option) => option.key === key)?.label ?? key} section and its structured data?`,
      )
    )
      return;
    onSectionsChange(sections.filter((section) => section !== key));
  }
  function move(index: number, offset: number) {
    const next = [...sections];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onSectionsChange(next);
  }
  if (!options.length) return null;
  return (
    <div className="specialized-sections" aria-label="Structured sections">
      <div className="section-heading">
        <h3>Structured sections</h3>
        {available.length > 0 && (
          <select
            aria-label="Add section"
            defaultValue=""
            onChange={(event) => {
              if (event.target.value)
                onSectionsChange([...sections, event.target.value]);
              event.target.value = "";
            }}
          >
            <option value="">Add section…</option>
            {available.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {sections.map((key, index) => (
        <section className="structured-card" key={key}>
          <div className="section-heading">
            <h4>
              {options.find((option) => option.key === key)?.label ?? key}
            </h4>
            <div>
              <button
                type="button"
                className="secondary"
                aria-label={`Move ${key} up`}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="secondary"
                aria-label={`Move ${key} down`}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="secondary danger"
                onClick={() => remove(key)}
              >
                Remove
              </button>
            </div>
          </div>
          <SectionFields
            sectionKey={key}
            specialization={specialization}
            images={images}
            statusSuggestions={statusSuggestions}
            onChange={onSpecializationChange}
            onSearchEntries={onSearchEntries}
          />
        </section>
      ))}
    </div>
  );
}

function SectionFields({
  sectionKey,
  specialization,
  images,
  statusSuggestions,
  onChange,
  onSearchEntries,
}: {
  sectionKey: string;
  specialization: EntrySpecialization;
  images: Media[];
  statusSuggestions: string[];
  onChange: (value: EntrySpecialization) => void;
  onSearchEntries: (query: string) => Promise<Entry[]>;
}) {
  if (
    sectionKey === "status" &&
    (specialization.type === "NPC" ||
      specialization.type === "QUEST" ||
      specialization.type === "FACTION")
  )
    return (
      <label>
        Status
        <input
          list="entry-status-suggestions"
          maxLength={80}
          value={specialization.status ?? ""}
          onChange={(event) =>
            onChange({ ...specialization, status: event.target.value || null })
          }
        />
        <datalist id="entry-status-suggestions">
          {statusSuggestions.map((status) => (
            <option value={status} key={status} />
          ))}
        </datalist>
      </label>
    );
  if (sectionKey === "portrait" && specialization.type === "NPC")
    return (
      <div className="portrait-field">
        {specialization.portraitMediaId &&
          images.find(
            (media) => media.id === specialization.portraitMediaId,
          ) && (
            <img
              src={
                images.find(
                  (media) => media.id === specialization.portraitMediaId,
                )!.urls.thumbnail
              }
              alt="NPC portrait preview"
            />
          )}
        <label>
          Portrait
          <select
            value={specialization.portraitMediaId ?? ""}
            onChange={(event) =>
              onChange({
                ...specialization,
                portraitMediaId: event.target.value || null,
              })
            }
          >
            <option value="">No portrait</option>
            {images.map((media) => (
              <option value={media.id} key={media.id}>
                {media.name}
                {media.isArchived ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  if (sectionKey === "currentLocation" && specialization.type === "NPC")
    return (
      <EntryReferencePicker
        label="Current location"
        type="LOCATION"
        value={specialization.currentLocationId}
        onChange={(currentLocationId) =>
          onChange({ ...specialization, currentLocationId })
        }
        onSearchEntries={onSearchEntries}
      />
    );
  if (sectionKey === "hierarchy" && specialization.type === "LOCATION")
    return (
      <>
        <EntryReferencePicker
          label="Parent location"
          type="LOCATION"
          value={specialization.parentLocationId}
          onChange={(parentLocationId) =>
            onChange({ ...specialization, parentLocationId })
          }
          onSearchEntries={onSearchEntries}
        />
        <label>
          Sibling order
          <input
            type="number"
            min={0}
            value={specialization.sortOrder}
            onChange={(event) =>
              onChange({
                ...specialization,
                sortOrder: Number(event.target.value),
              })
            }
          />
        </label>
      </>
    );
  if (sectionKey === "objectives" && specialization.type === "QUEST")
    return (
      <CollectionEditor
        items={specialization.objectives}
        addLabel="Add objective"
        onMove={(from, to) =>
          onChange({
            ...specialization,
            objectives: moveItem(specialization.objectives, from, to),
          })
        }
        onAdd={() =>
          onChange({
            ...specialization,
            objectives: [
              ...specialization.objectives,
              {
                id: crypto.randomUUID(),
                text: "New objective",
                completed: false,
              },
            ],
          })
        }
        render={(objective, index) => (
          <div className="inline-form">
            <input
              aria-label={`Objective ${index + 1} complete`}
              type="checkbox"
              checked={objective.completed}
              onChange={(event) =>
                onChange({
                  ...specialization,
                  objectives: specialization.objectives.map((item) =>
                    item.id === objective.id
                      ? { ...item, completed: event.target.checked }
                      : item,
                  ),
                })
              }
            />
            <input
              aria-label={`Objective ${index + 1}`}
              maxLength={500}
              value={objective.text}
              onChange={(event) =>
                onChange({
                  ...specialization,
                  objectives: specialization.objectives.map((item) =>
                    item.id === objective.id
                      ? { ...item, text: event.target.value }
                      : item,
                  ),
                })
              }
            />
            <button
              type="button"
              className="secondary danger"
              onClick={() =>
                onChange({
                  ...specialization,
                  objectives: specialization.objectives.filter(
                    (item) => item.id !== objective.id,
                  ),
                })
              }
            >
              Remove
            </button>
          </div>
        )}
      />
    );
  if (sectionKey === "leadership" && specialization.type === "FACTION")
    return (
      <CollectionEditor
        items={specialization.leaders}
        addLabel="Add leader"
        onMove={(from, to) =>
          onChange({
            ...specialization,
            leaders: moveItem(specialization.leaders, from, to),
          })
        }
        onAdd={() =>
          onChange({
            ...specialization,
            leaders: [
              ...specialization.leaders,
              { id: crypto.randomUUID(), npcId: "", role: null },
            ],
          })
        }
        render={(leader, index) => (
          <div className="collection-card">
            <EntryReferencePicker
              label={`Leader ${index + 1}`}
              type="NPC"
              value={leader.npcId || null}
              onChange={(npcId) =>
                onChange({
                  ...specialization,
                  leaders: specialization.leaders.map((item) =>
                    item.id === leader.id
                      ? { ...item, npcId: npcId ?? "" }
                      : item,
                  ),
                })
              }
              onSearchEntries={onSearchEntries}
            />
            <label>
              Role
              <input
                maxLength={120}
                value={leader.role ?? ""}
                onChange={(event) =>
                  onChange({
                    ...specialization,
                    leaders: specialization.leaders.map((item) =>
                      item.id === leader.id
                        ? { ...item, role: event.target.value || null }
                        : item,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              className="secondary danger"
              onClick={() =>
                onChange({
                  ...specialization,
                  leaders: specialization.leaders.filter(
                    (item) => item.id !== leader.id,
                  ),
                })
              }
            >
              Remove leader
            </button>
          </div>
        )}
      />
    );
  if (
    sectionKey === "inventory" &&
    (specialization.type === "NPC" || specialization.type === "LOCATION")
  )
    return (
      <InventoryEditor
        specialization={specialization}
        onChange={onChange}
        onSearchEntries={onSearchEntries}
      />
    );
  return null;
}

function CollectionEditor<T>({
  items,
  addLabel,
  onAdd,
  onMove,
  render,
}: {
  items: T[];
  addLabel: string;
  onAdd: () => void;
  onMove: (from: number, to: number) => void;
  render: (item: T, index: number) => React.ReactNode;
}) {
  return (
    <div className="structured-collection">
      {items.map((item, index) => (
        <div className="ordered-item" key={index}>
          <div className="ordered-actions">
            <button
              type="button"
              className="secondary"
              disabled={index === 0}
              onClick={() => onMove(index, index - 1)}
            >
              Move up
            </button>
            <button
              type="button"
              className="secondary"
              disabled={index === items.length - 1}
              onClick={() => onMove(index, index + 1)}
            >
              Move down
            </button>
          </div>
          {render(item, index)}
        </div>
      ))}
      <button type="button" className="secondary" onClick={onAdd}>
        {addLabel}
      </button>
    </div>
  );
}

function EntryReferencePicker({
  label,
  type,
  value,
  onChange,
  onSearchEntries,
}: {
  label: string;
  type: EntryType;
  value: string | null;
  onChange: (id: string | null) => void;
  onSearchEntries: (query: string) => Promise<Entry[]>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Entry[]>([]);
  return (
    <div>
      <label>
        {label}
        <input
          value={query}
          placeholder={value ? `Selected: ${value}` : "Search by title"}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="secondary"
        onClick={() =>
          void onSearchEntries(query).then((entries) =>
            setResults(entries.filter((candidate) => candidate.type === type)),
          )
        }
      >
        Search
      </button>
      {value && (
        <button
          type="button"
          className="secondary"
          onClick={() => onChange(null)}
        >
          Clear
        </button>
      )}
      <ul className="knowledge-list">
        {results.map((result) => (
          <li key={result.id}>
            <button
              type="button"
              onClick={() => {
                onChange(result.id);
                setQuery(result.title);
                setResults([]);
              }}
            >
              {result.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

function InventoryEditor({
  specialization,
  onChange,
  onSearchEntries,
}: {
  specialization: Extract<EntrySpecialization, { type: "NPC" | "LOCATION" }>;
  onChange: (value: EntrySpecialization) => void;
  onSearchEntries: (query: string) => Promise<Entry[]>;
}) {
  return (
    <CollectionEditor
      items={specialization.inventories}
      addLabel="Add inventory"
      onMove={(from, to) =>
        onChange({
          ...specialization,
          inventories: moveItem(specialization.inventories, from, to),
        })
      }
      onAdd={() =>
        onChange({
          ...specialization,
          inventories: [
            ...specialization.inventories,
            { id: crypto.randomUUID(), name: "Inventory", lines: [] },
          ],
        })
      }
      render={(inventory, inventoryIndex) => (
        <div className="collection-card">
          <label>
            Inventory name
            <input
              maxLength={120}
              value={inventory.name}
              onChange={(event) =>
                onChange({
                  ...specialization,
                  inventories: specialization.inventories.map((item) =>
                    item.id === inventory.id
                      ? { ...item, name: event.target.value }
                      : item,
                  ),
                })
              }
            />
          </label>
          {inventory.lines.map((line, lineIndex) => (
            <div className="collection-card" key={line.id}>
              <div className="ordered-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={lineIndex === 0}
                  onClick={() =>
                    onChange({
                      ...specialization,
                      inventories: specialization.inventories.map((item) =>
                        item.id === inventory.id
                          ? {
                              ...item,
                              lines: moveItem(
                                item.lines,
                                lineIndex,
                                lineIndex - 1,
                              ),
                            }
                          : item,
                      ),
                    })
                  }
                >
                  Move item up
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={lineIndex === inventory.lines.length - 1}
                  onClick={() =>
                    onChange({
                      ...specialization,
                      inventories: specialization.inventories.map((item) =>
                        item.id === inventory.id
                          ? {
                              ...item,
                              lines: moveItem(
                                item.lines,
                                lineIndex,
                                lineIndex + 1,
                              ),
                            }
                          : item,
                      ),
                    })
                  }
                >
                  Move item down
                </button>
              </div>
              <EntryReferencePicker
                label={`Item ${lineIndex + 1}`}
                type="ITEM"
                value={line.itemId || null}
                onChange={(itemId) =>
                  onChange({
                    ...specialization,
                    inventories: specialization.inventories.map((item) =>
                      item.id === inventory.id
                        ? {
                            ...item,
                            lines: item.lines.map((candidate) =>
                              candidate.id === line.id
                                ? { ...candidate, itemId: itemId ?? "" }
                                : candidate,
                            ),
                          }
                        : item,
                    ),
                  })
                }
                onSearchEntries={onSearchEntries}
              />
              <label>
                Quantity
                <input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(event) =>
                    onChange({
                      ...specialization,
                      inventories: specialization.inventories.map((item) =>
                        item.id === inventory.id
                          ? {
                              ...item,
                              lines: item.lines.map((candidate) =>
                                candidate.id === line.id
                                  ? {
                                      ...candidate,
                                      quantity: Number(event.target.value),
                                    }
                                  : candidate,
                              ),
                            }
                          : item,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Note
                <input
                  maxLength={500}
                  value={line.note ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...specialization,
                      inventories: specialization.inventories.map((item) =>
                        item.id === inventory.id
                          ? {
                              ...item,
                              lines: item.lines.map((candidate) =>
                                candidate.id === line.id
                                  ? {
                                      ...candidate,
                                      note: event.target.value || null,
                                    }
                                  : candidate,
                              ),
                            }
                          : item,
                      ),
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="secondary danger"
                onClick={() =>
                  onChange({
                    ...specialization,
                    inventories: specialization.inventories.map((item) =>
                      item.id === inventory.id
                        ? {
                            ...item,
                            lines: item.lines.filter(
                              (candidate) => candidate.id !== line.id,
                            ),
                          }
                        : item,
                    ),
                  })
                }
              >
                Remove item
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() =>
              onChange({
                ...specialization,
                inventories: specialization.inventories.map((item) =>
                  item.id === inventory.id
                    ? {
                        ...item,
                        lines: [
                          ...item.lines,
                          {
                            id: crypto.randomUUID(),
                            itemId: "",
                            quantity: 1,
                            note: null,
                          },
                        ],
                      }
                    : item,
                ),
              })
            }
          >
            Add item
          </button>
          <button
            type="button"
            className="secondary danger"
            onClick={() =>
              onChange({
                ...specialization,
                inventories: specialization.inventories.filter(
                  (item) => item.id !== inventory.id,
                ),
              })
            }
          >
            Remove inventory {inventoryIndex + 1}
          </button>
        </div>
      )}
    />
  );
}
