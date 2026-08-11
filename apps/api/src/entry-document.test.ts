import { describe, expect, it } from "vitest";

import {
  EMPTY_ENTRY_DOCUMENT,
  EntryDocumentValidationError,
  MAX_ENTRY_DOCUMENT_BYTES,
  validateEntryDocument,
} from "./entry-document.js";

describe("Entry document validation", () => {
  it("accepts the empty document and supported notebook formatting", () => {
    expect(validateEntryDocument(EMPTY_ENTRY_DOCUMENT)).toEqual(
      EMPTY_ENTRY_DOCUMENT,
    );
    expect(
      validateEntryDocument({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [
              { type: "text", text: "Plans", marks: [{ type: "bold" }] },
            ],
          },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [{ type: "paragraph" }],
              },
            ],
          },
          {
            type: "codeBlock",
            attrs: { language: null },
            content: [{ type: "text", text: "secret" }],
          },
        ],
      }),
    ).toMatchObject({ type: "doc" });
  });

  it.each([
    [{ type: "doc", content: [{ type: "image" }] }, "type"],
    [{ type: "doc", content: [{ type: "html", text: "<script>" }] }, "type"],
    [
      {
        type: "doc",
        content: [{ type: "paragraph", attrs: { onclick: "bad" } }],
      },
      "attrs",
    ],
    [
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "link", marks: [{ type: "link" }] },
            ],
          },
        ],
      },
      "type",
    ],
    [
      {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "paragraph" }] }],
      },
      "structure",
    ],
  ])("rejects unsupported or invalid content", (document, message) => {
    expect(() => validateEntryDocument(document)).toThrow(
      EntryDocumentValidationError,
    );
    expect(() => validateEntryDocument(document)).toThrow(message);
  });

  it("rejects documents larger than 1 MiB", () => {
    const document = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "x".repeat(MAX_ENTRY_DOCUMENT_BYTES) },
          ],
        },
      ],
    };

    expect(() => validateEntryDocument(document)).toThrow("1 MiB");
  });
});
