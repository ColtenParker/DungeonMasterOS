import { getSchema, Mark, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

export const ENTRY_DOCUMENT_VERSION = 2;
export const MAX_ENTRY_DOCUMENT_BYTES = 1024 * 1024;
export const EMPTY_ENTRY_DOCUMENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const baseEntryDocumentExtensions = [
  StarterKit.configure({
    horizontalRule: false,
    link: false,
    underline: false,
  }),
];

export const entryLinkMark = Mark.create({
  name: "entryLink",
  inclusive: false,
  addAttributes() {
    return { entryId: { default: null } };
  },
  parseHTML() {
    return [{ tag: "span[data-entry-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      {
        "data-entry-id": HTMLAttributes.entryId as string,
        class: "entry-link",
      },
      0,
    ];
  },
});

export const entryDocumentExtensions = [
  ...baseEntryDocumentExtensions,
  entryLinkMark,
];

const entryDocumentSchemas = new Map([
  [1, getSchema(baseEntryDocumentExtensions)],
  [2, getSchema(entryDocumentExtensions)],
]);
const nodeTypes = new Set([
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "text",
]);
const baseMarkTypes = new Set(["bold", "italic", "strike", "code"]);

export class EntryDocumentValidationError extends Error {}

function objectValue(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EntryDocumentValidationError(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
) {
  const unknownKey = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknownKey) {
    throw new EntryDocumentValidationError(
      `${path}.${unknownKey} is not supported.`,
    );
  }
}

function validateMarks(value: unknown, path: string, documentVersion: number) {
  if (!Array.isArray(value)) {
    throw new EntryDocumentValidationError(`${path} must be an array.`);
  }
  value.forEach((rawMark, index) => {
    const markPath = `${path}[${index}]`;
    const mark = objectValue(rawMark, markPath);
    const allowedMarkTypes =
      documentVersion >= 2
        ? new Set([...baseMarkTypes, "entryLink"])
        : baseMarkTypes;
    if (typeof mark.type !== "string" || !allowedMarkTypes.has(mark.type)) {
      throw new EntryDocumentValidationError(
        `${markPath}.type is not supported.`,
      );
    }
    if (mark.type === "entryLink") {
      assertKeys(mark, ["type", "attrs"], markPath);
      const attrs = objectValue(mark.attrs, `${markPath}.attrs`);
      assertKeys(attrs, ["entryId"], `${markPath}.attrs`);
      if (
        typeof attrs.entryId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          attrs.entryId,
        )
      ) {
        throw new EntryDocumentValidationError(
          `${markPath}.attrs.entryId must be a UUID.`,
        );
      }
    } else {
      assertKeys(mark, ["type"], markPath);
    }
  });
}

function validateAttrs(type: string, rawAttrs: unknown, path: string) {
  const attrs = objectValue(rawAttrs, `${path}.attrs`);
  if (type === "heading") {
    assertKeys(attrs, ["level"], `${path}.attrs`);
    if (
      typeof attrs.level !== "number" ||
      !Number.isInteger(attrs.level) ||
      attrs.level < 1 ||
      attrs.level > 6
    ) {
      throw new EntryDocumentValidationError(
        `${path}.attrs.level must be an integer from 1 to 6.`,
      );
    }
    return;
  }
  if (type === "orderedList") {
    assertKeys(attrs, ["start", "type"], `${path}.attrs`);
    if (
      typeof attrs.start !== "number" ||
      !Number.isInteger(attrs.start) ||
      attrs.start < 1 ||
      attrs.type !== null
    ) {
      throw new EntryDocumentValidationError(
        `${path}.attrs is not a valid ordered-list attribute object.`,
      );
    }
    return;
  }
  if (type === "codeBlock") {
    assertKeys(attrs, ["language"], `${path}.attrs`);
    if (attrs.language !== null) {
      throw new EntryDocumentValidationError(
        `${path}.attrs.language must be null.`,
      );
    }
    return;
  }
  throw new EntryDocumentValidationError(`${path}.attrs is not supported.`);
}

function validateNode(rawNode: unknown, path: string, documentVersion: number) {
  const node = objectValue(rawNode, path);
  if (typeof node.type !== "string" || !nodeTypes.has(node.type)) {
    throw new EntryDocumentValidationError(`${path}.type is not supported.`);
  }

  const allowed = ["type"];
  if (!new Set(["text", "hardBreak"]).has(node.type)) allowed.push("content");
  if (node.type === "text") allowed.push("text", "marks");
  if (new Set(["heading", "orderedList", "codeBlock"]).has(node.type)) {
    allowed.push("attrs");
  }
  assertKeys(node, allowed, path);

  if (node.type === "text") {
    if (typeof node.text !== "string" || node.text.length === 0) {
      throw new EntryDocumentValidationError(
        `${path}.text must be a non-empty string.`,
      );
    }
    if (node.marks !== undefined) {
      validateMarks(node.marks, `${path}.marks`, documentVersion);
    }
  }

  if (node.attrs !== undefined) validateAttrs(node.type, node.attrs, path);

  if (node.content !== undefined) {
    if (!Array.isArray(node.content)) {
      throw new EntryDocumentValidationError(
        `${path}.content must be an array.`,
      );
    }
    node.content.forEach((child, index) =>
      validateNode(child, `${path}.content[${index}]`, documentVersion),
    );
  }
}

export function validateEntryDocument(
  value: unknown,
  documentVersion = ENTRY_DOCUMENT_VERSION,
): JSONContent {
  const schema = entryDocumentSchemas.get(documentVersion);
  if (!schema) {
    throw new EntryDocumentValidationError(
      `Document version ${documentVersion} is not supported.`,
    );
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new EntryDocumentValidationError(
      "The document must be valid JSON content.",
    );
  }
  if (Buffer.byteLength(serialized, "utf8") > MAX_ENTRY_DOCUMENT_BYTES) {
    throw new EntryDocumentValidationError(
      "The document must not exceed 1 MiB.",
    );
  }

  validateNode(value, "document", documentVersion);
  const documentObject = objectValue(value, "document");
  if (documentObject.type !== "doc") {
    throw new EntryDocumentValidationError(
      "The document root type must be doc.",
    );
  }

  try {
    const documentNode = schema.nodeFromJSON(value);
    documentNode.check();
  } catch {
    throw new EntryDocumentValidationError(
      "The document structure does not match the supported schema.",
    );
  }

  return value as JSONContent;
}

function visitDocument(
  value: JSONContent,
  visitor: (node: JSONContent) => void,
) {
  visitor(value);
  value.content?.forEach((child) => visitDocument(child, visitor));
}

export function extractEntryLinkTargetIds(document: JSONContent): string[] {
  const identifiers = new Set<string>();
  visitDocument(document, (node) => {
    node.marks?.forEach((mark) => {
      if (
        mark.type === "entryLink" &&
        typeof mark.attrs?.entryId === "string"
      ) {
        identifiers.add(mark.attrs.entryId);
      }
    });
  });
  return [...identifiers].sort();
}

function textForNode(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  const separator = new Set([
    "doc",
    "blockquote",
    "bulletList",
    "orderedList",
    "listItem",
  ]).has(node.type ?? "")
    ? "\n"
    : "";
  return (node.content ?? []).map(textForNode).join(separator);
}

export function extractEntryDocumentText(document: JSONContent): string {
  return textForNode(document)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
