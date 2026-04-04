"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect } from "react";

interface RichEditorFullProps {
  content: string;
  onChange: (html: string) => void;
}

export function RichEditorFull({ content, onChange }: RichEditorFullProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt("URL du lien :");
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  const btnClass = (active: boolean) =>
    `px-2 py-1 rounded text-xs transition-colors ${
      active ? "bg-[#E35205] text-white" : "hover:bg-muted text-foreground"
    }`;

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
      </div>
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-4 py-3 min-h-[300px] focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[280px] text-sm"
      />
    </div>
  );
}
