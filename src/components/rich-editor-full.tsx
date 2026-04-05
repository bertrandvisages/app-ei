"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Node } from "@tiptap/pm/model";
import { useEffect } from "react";
import Heading from "@tiptap/extension-heading";

// Clean HTML for Tiptap compatibility
function cleanHtmlForTiptap(html: string): string {
  // Remove <div> wrappers but keep content
  let cleaned = html.replace(/<div[^>]*>/gi, "").replace(/<\/div>/gi, "");
  // Remove id, class, data-* attributes from tags (keep href, target, rel, src)
  cleaned = cleaned.replace(/<(\w+)\s+([^>]*)>/gi, (match, tag, attrs) => {
    // Keep only safe attributes
    const safeAttrs: string[] = [];
    const attrRegex = /(href|target|rel|src|alt|border|cellpadding|cellspacing|colspan|rowspan)="[^"]*"/gi;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrs)) !== null) {
      safeAttrs.push(attrMatch[0]);
    }
    return safeAttrs.length > 0 ? `<${tag} ${safeAttrs.join(" ")}>` : `<${tag}>`;
  });
  return cleaned;
}

interface RichEditorFullProps {
  content: string;
  onChange: (html: string) => void;
}

export function RichEditorFull({ content, onChange }: RichEditorFullProps) {
  const cleanedContent = cleanHtmlForTiptap(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      Heading.configure({ levels: [2, 3, 4] }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            id: {
              default: null,
              parseHTML: (element: HTMLElement) => element.getAttribute("id"),
              renderHTML: (attributes: Record<string, unknown>) => {
                if (!attributes.id) return {};
                return { id: attributes.id };
              },
            },
          };
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            colspan: {
              default: 1,
              parseHTML: (element: HTMLElement) => parseInt(element.getAttribute("colspan") || "1", 10),
            },
            rowspan: {
              default: 1,
              parseHTML: (element: HTMLElement) => parseInt(element.getAttribute("rowspan") || "1", 10),
            },
          };
        },
      }),
      TableHeader.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            colspan: {
              default: 1,
              parseHTML: (element: HTMLElement) => parseInt(element.getAttribute("colspan") || "1", 10),
            },
            rowspan: {
              default: 1,
              parseHTML: (element: HTMLElement) => parseInt(element.getAttribute("rowspan") || "1", 10),
            },
          };
        },
      }),
    ],
    content: cleanedContent,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor) {
      const cleaned = cleanHtmlForTiptap(content);
      if (cleaned !== editor.getHTML()) {
        editor.commands.setContent(cleaned);
      }
    }
  }, [content, editor]);

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt("URL du lien :");
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const btnClass = (active: boolean) =>
    `px-2 py-1 rounded text-xs transition-colors ${
      active ? "bg-[#E35205] text-white" : "hover:bg-muted text-foreground"
    }`;

  const btnDisabled = "px-2 py-1 rounded text-xs hover:bg-muted text-foreground";

  return (
    <div className="rounded-md border bg-background">
      <div className="flex gap-1 border-b px-2 py-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btnClass(editor.isActive("heading", { level: 2 }))}
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={btnClass(editor.isActive("heading", { level: 3 }))}
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          className={btnClass(editor.isActive("heading", { level: 4 }))}
        >
          H4
        </button>
        <div className="w-px bg-border mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${btnClass(editor.isActive("bold"))} font-bold`}
        >
          G
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`${btnClass(editor.isActive("italic"))} italic`}
        >
          I
        </button>
        <div className="w-px bg-border mx-1" />
        <button
          type="button"
          onClick={addLink}
          className={btnClass(editor.isActive("link"))}
        >
          Lien
        </button>
        {editor.isActive("link") && (
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            className="px-2 py-1 rounded text-xs hover:bg-muted text-destructive"
          >
            Suppr. lien
          </button>
        )}
        <div className="w-px bg-border mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btnClass(editor.isActive("bulletList"))}
        >
          Liste
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btnClass(editor.isActive("orderedList"))}
        >
          1. Liste
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={btnClass(editor.isActive("blockquote"))}
        >
          Citation
        </button>
        <div className="w-px bg-border mx-1" />
        <button type="button" onClick={addTable} className={btnDisabled}>
          Tableau
        </button>
        {editor.isActive("table") && (
          <>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className={btnDisabled}
            >
              + Col
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className={btnDisabled}
            >
              + Ligne
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteColumn().run()}
              className="px-2 py-1 rounded text-xs hover:bg-muted text-destructive"
            >
              - Col
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteRow().run()}
              className="px-2 py-1 rounded text-xs hover:bg-muted text-destructive"
            >
              - Ligne
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteTable().run()}
              className="px-2 py-1 rounded text-xs hover:bg-muted text-destructive"
            >
              Suppr. tableau
            </button>
          </>
        )}
      </div>
      <style>{`
        .tiptap table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        .tiptap th, .tiptap td {
          border: 1px solid #d1d5db;
          padding: 8px 12px;
          text-align: left;
          font-size: 13px;
        }
        .tiptap th {
          background: #f3f4f6;
          font-weight: 600;
        }
        .tiptap .selectedCell {
          background: #fff3ed;
        }
        .tiptap h2 {
          font-size: 1.25rem;
          font-weight: 700;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }
        .tiptap h3 {
          font-size: 1.1rem;
          font-weight: 600;
          margin-top: 1.25em;
          margin-bottom: 0.4em;
        }
        .tiptap h4 {
          font-size: 1rem;
          font-weight: 600;
          margin-top: 1em;
          margin-bottom: 0.3em;
        }
        .tiptap p {
          margin-bottom: 0.75em;
        }
        .tiptap ul, .tiptap ol {
          padding-left: 1.5em;
          margin-bottom: 0.75em;
        }
        .tiptap blockquote {
          border-left: 3px solid #E35205;
          padding-left: 1em;
          margin: 1em 0;
          color: #6b7280;
        }
        .tiptap a {
          color: #E35205;
          text-decoration: underline;
        }
      `}</style>
      <EditorContent
        editor={editor}
        className="max-w-none px-4 py-3 min-h-[300px] focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[280px] text-sm"
      />
    </div>
  );
}
