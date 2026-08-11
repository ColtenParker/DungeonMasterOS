import { getSchema, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

export const ENTRY_DOCUMENT_VERSION = 1;
export const MAX_ENTRY_DOCUMENT_BYTES = 1024 * 1024;
export const EMPTY_ENTRY_DOCUMENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export const entryDocumentExtensions = [
  StarterKit.configure({
    horizontalRule: false,
    link: false,
    underline: false,
  }),
];

const entryDocumentSchema = getSchema(entryDocumentExtensions);
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
const markTypes = new Set(["bold", "italic", "strike", "code"]);

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

function validateMarks(value: unknown, path: string) {
  if (!Array.isArray(value)) {
    throw new EntryDocumentValidationError(`${path} must be an array.`);
  }
  value.forEach((rawMark, index) => {
    const markPath = `${path}[${index}]`;
    const mark = objectValue(rawMark, markPath);
    assertKeys(mark, ["type"], markPath);
    if (typeof mark.type !== "string" || !markTypes.has(mark.type)) {
      throw new EntryDocumentValidationError(
        `${markPath}.type is not supported.`,
      );
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

function validateNode(rawNode: unknown, path: string) {
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
    if (node.marks !== undefined) validateMarks(node.marks, `${path}.marks`);
  }

  if (node.attrs !== undefined) validateAttrs(node.type, node.attrs, path);

  if (node.content !== undefined) {
    if (!Array.isArray(node.content)) {
      throw new EntryDocumentValidationError(
        `${path}.content must be an array.`,
      );
    }
    node.content.forEach((child, index) =>
      validateNode(child, `${path}.content[${index}]`),
    );
  }
}

export function validateEntryDocument(value: unknown): JSONContent {
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

  validateNode(value, "document");
  const documentObject = objectValue(value, "document");
  if (documentObject.type !== "doc") {
    throw new EntryDocumentValidationError(
      "The document root type must be doc.",
    );
  }

  try {
    const documentNode = entryDocumentSchema.nodeFromJSON(value);
    documentNode.check();
  } catch {
    throw new EntryDocumentValidationError(
      "The document structure does not match the supported schema.",
    );
  }

  return value as JSONContent;
}
