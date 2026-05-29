"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect, useReducer } from "react";

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
}

export function RichEditor({ content, onChange }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        code: false,
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

  // Force le re-render de la toolbar quand le curseur bouge — sinon
  // editor.isActive("bold"|"link"|...) ne reflete pas l'etat reel.
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (!editor) return;
    const handler = () => forceUpdate();
    editor.on("selectionUpdate", handler);
    editor.on("transaction", handler);
    return () => {
      editor.off("selectionUpdate", handler);
      editor.off("transaction", handler);
    };
  }, [editor]);

  if (!editor) return null;

  const addLink = () => {
    // Pre-rempli avec l'URL actuelle si on est deja sur un lien, sinon vide.
    // Permet d'editer un lien existant sans avoir a tout retaper.
    const currentUrl =
      (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt("URL du lien :", currentUrl);
    if (url === null) return; // annule
    if (url === "") {
      // L'editeur a vide le champ : on retire le lien
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="rounded-md border bg-background">
      <div className="sticky top-0 z-20 flex gap-1 border-b px-2 py-1.5 bg-background rounded-t-md">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
            editor.isActive("bold") ? "bg-[#E35205] text-white" : "hover:bg-muted"
          }`}
        >
          G
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 rounded text-xs italic transition-colors ${
            editor.isActive("italic") ? "bg-[#E35205] text-white" : "hover:bg-muted"
          }`}
        >
          I
        </button>
        <button
          type="button"
          onClick={addLink}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            editor.isActive("link") ? "bg-[#E35205] text-white" : "hover:bg-muted"
          }`}
        >
          Lien
        </button>
        {editor.isActive("link") && (
          <button
            type="button"
            onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
            className="px-2 py-1 rounded text-xs hover:bg-muted text-destructive"
          >
            Suppr. lien
          </button>
        )}
      </div>
      {/* Style explicite des liens : le reset `prose` Tailwind ne suffit pas
          toujours pour faire ressortir un lien en cours d'edition. */}
      <style>{`
        .tiptap a {
          color: #E35205;
          text-decoration: underline;
          text-underline-offset: 2px;
          cursor: text;
        }
      `}</style>
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-3 py-2 min-h-[120px] focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[100px] text-sm"
      />
    </div>
  );
}
