import { Mark } from "@tiptap/core";

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
        role: "link",
      },
      0,
    ];
  },
});
