"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Image from "@tiptap/extension-image";
import { useEffect, useReducer, useRef, useState } from "react";
import Heading from "@tiptap/extension-heading";

function cleanHtmlForTiptap(html: string): string {
  let cleaned = html.replace(/<div[^>]*>/gi, "").replace(/<\/div>/gi, "");
  cleaned = cleaned.replace(/<(\w+)\s+([^>]*)>/gi, (_match, tag, attrs) => {
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

// L'editeur ne connait que les niveaux H2/H3/H4 (cf. Heading.configure plus
// bas) et le site public stylise H2/H3/H4. Word produit le plus souvent du
// H1 pour les titres : on decale donc tout d'un cran (H1->H2) et on rabat les
// niveaux profonds (H5/H6) sur H4 pour ne rien perdre.
function shiftHeadingsForEditor(html: string): string {
  return html
    .replace(/<(\/?)h1(\s[^>]*)?>/gi, "<$1h2$2>")
    .replace(/<(\/?)h5(\s[^>]*)?>/gi, "<$1h4$2>")
    .replace(/<(\/?)h6(\s[^>]*)?>/gi, "<$1h4$2>");
}

// Les images Word arrivent en base64 inline, que l'editeur refuse
// (Image.allowBase64 = false). On les retire et on renvoie le compte pour
// pouvoir prevenir l'utilisateur qu'il doit les reinserer manuellement.
function stripImages(html: string): { html: string; count: number } {
  let count = 0;
  const cleaned = html.replace(/<img\b[^>]*>/gi, () => {
    count += 1;
    return "";
  });
  return { html: cleaned, count };
}

// Word francais nomme ses styles "Titre 1/2/3" et l'anglais "Heading 1/2/3".
// On mappe les deux vers H2/H3/H4 ; mammoth garde sa style-map par defaut
// (gras, italique, listes, tableaux, liens) en plus de celle-ci.
const WORD_STYLE_MAP = [
  "p[style-name='Title'] => h2:fresh",
  "p[style-name='Titre'] => h2:fresh",
  "p[style-name='Heading 1'] => h2:fresh",
  "p[style-name='Titre 1'] => h2:fresh",
  "p[style-name='Heading 2'] => h3:fresh",
  "p[style-name='Titre 2'] => h3:fresh",
  "p[style-name='Heading 3'] => h4:fresh",
  "p[style-name='Titre 3'] => h4:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Titre 4'] => h4:fresh",
];

interface RichEditorFullProps {
  content: string;
  onChange: (html: string) => void;
}

export function RichEditorFull({ content, onChange }: RichEditorFullProps) {
  const cleanedContent = cleanHtmlForTiptap(content);
  const [hasFocus, setHasFocus] = useState(false);

  const editor = useEditor({
    // immediatelyRender:false est OBLIGATOIRE avec Tiptap v3 + Next.js App
    // Router. Sans ça, l'editeur essaie de rendre cote serveur, hydrate
    // differemment cote client et CRASH la page ("This page couldn't load")
    // — bug observe quand on ajoute une nouvelle extension comme Image.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
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
    onFocus: () => setHasFocus(true),
    onBlur: () => setHasFocus(false),
  });

  useEffect(() => {
    if (editor) {
      const cleaned = cleanHtmlForTiptap(content);
      if (cleaned !== editor.getHTML()) {
        editor.commands.setContent(cleaned);
      }
    }
  }, [content, editor]);

  // Tiptap ne previent pas React quand la selection bouge dans l'editeur.
  // Sans ce hook, editor.isActive("heading", { level: 2 }) renvoie une
  // valeur fige et les boutons de la toolbar ne se mettent jamais a jour
  // selon le curseur (H2 reste eteint quand on clique dans un H2, etc.).
  // On force un re-render a chaque selectionUpdate / transaction.
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (!editor) return;
    const onSelectionUpdate = () => forceUpdate();
    const onTransaction = () => forceUpdate();
    editor.on("selectionUpdate", onSelectionUpdate);
    editor.on("transaction", onTransaction);
    return () => {
      editor.off("selectionUpdate", onSelectionUpdate);
      editor.off("transaction", onTransaction);
    };
  }, [editor]);

  // ⚠ Tous les hooks (useState/useRef/useEffect/useReducer) DOIVENT etre
  // declares au-dessus du early return ci-dessous, sinon React leve l'erreur
  // #310 (rendered fewer/more hooks than expected) car le premier render
  // (editor undefined → return null) skipperait les hooks suivants.
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const wordInputRef = useRef<HTMLInputElement>(null);
  const [importingWord, setImportingWord] = useState(false);

  if (!editor) return null;

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  const addLink = () => {
    // Pre-rempli avec l'URL actuelle si on est deja sur un lien, sinon vide.
    // Permet d'editer un lien existant sans avoir a tout retaper.
    const currentUrl =
      (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt("URL du lien :", currentUrl);
    if (url === null) return; // annule
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addTable = () => {
    editor.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  // Upload image dans le body : meme pipeline que les covers
  // (/api/wordpress/upload → toAvif → Supabase Storage). On insere l'image
  // au curseur via Tiptap.setImage.
  // (imageInputRef + uploadingImage declares plus haut pour respecter
  // l'ordre des hooks)
  const triggerImagePicker = () => imageInputRef.current?.click();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      window.alert("Le fichier doit être une image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      window.alert(
        `Fichier trop lourd (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite : 5 MB.`
      );
      return;
    }

    const alt = window.prompt(
      "Texte alternatif (description courte de l'image, important pour le SEO et l'accessibilité) :",
      ""
    );
    if (alt === null) return; // annule

    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "body/inline");
      const res = await fetch("/api/wordpress/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload échoué");

      editor.chain().focus().setImage({ src: data.url, alt: alt.trim() }).run();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Upload échoué");
    } finally {
      setUploadingImage(false);
    }
  };

  // Import Word (.docx) : conversion en HTML cote client via mammoth, puis
  // insertion au curseur. On garde la mise en forme (gras/italique, listes,
  // tableaux, liens) et on rabat les titres sur H2/H3/H4. Les images Word
  // (base64) ne sont pas importees — l'editeur ne les accepte pas.
  const triggerWordPicker = () => wordInputRef.current?.click();

  const handleWordImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".docx")) {
      window.alert(
        "Format non supporté : seuls les fichiers Word .docx fonctionnent (pas le vieux .doc ni le PDF)."
      );
      return;
    }

    setImportingWord(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      // On importe "mammoth" (et non le sous-chemin .browser) : son champ
      // package.json "browser" remappe deja les modules Node (unzip/files)
      // vers leurs equivalents navigateur, et ce point d'entree fournit les
      // types TS. Import dynamique = la lib n'est chargee qu'au 1er import.
      const mammoth = (await import("mammoth")).default;
      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        { styleMap: WORD_STYLE_MAP }
      );

      const shifted = shiftHeadingsForEditor(result.value);
      const { html: noImages, count: droppedImages } = stripImages(shifted);
      const cleaned = cleanHtmlForTiptap(noImages);

      if (!cleaned.trim()) {
        window.alert("Le document semble vide, rien à importer.");
        return;
      }

      // insertContent (et non setContent) : on insere au curseur sans ecraser
      // ce qui est deja saisi. onUpdate propage le HTML via onChange.
      editor.chain().focus().insertContent(cleaned).run();

      if (droppedImages > 0) {
        window.alert(
          `Import terminé. ${droppedImages} image(s) du document n'ont pas pu être importées — ajoute-les manuellement avec le bouton « Image ».`
        );
      }
    } catch (err) {
      console.error("[word-import]", err);
      window.alert(
        err instanceof Error
          ? `Import échoué : ${err.message}`
          : "Import échoué."
      );
    } finally {
      setImportingWord(false);
    }
  };

  // Only show active state when editor has focus
  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    hasFocus && editor.isActive(name, attrs);

  const btnClass = (active: boolean) =>
    `px-2 py-1 rounded text-xs transition-colors ${
      active ? "bg-[#E35205] text-white" : "hover:bg-muted text-foreground"
    }`;

  const btnBase = "px-2 py-1 rounded text-xs hover:bg-muted text-foreground";

  // max-height + overflow-y:auto sur le wrapper = scope du sticky. La
  // toolbar sticky plus bas se cale en haut de ce conteneur quand l'editeur
  // scrolle son contenu. Sans ce wrapper scrollable, la Table englobante
  // a overflow-x:auto qui empechait le sticky de se declencher.
  return (
    <div className="rounded-md border bg-background max-h-[70vh] overflow-y-auto">
      <div className="sticky top-0 z-20 flex gap-1 border-b px-2 py-1.5 flex-wrap bg-background rounded-t-md">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setParagraph().run(); }}
          className={btnClass(isActive("paragraph"))}
          title="Paragraphe normal"
        >
          P
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().toggleHeading({ level: 2 }).run(); }}
          className={btnClass(isActive("heading", { level: 2 }))}
        >
          H2
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().toggleHeading({ level: 3 }).run(); }}
          className={btnClass(isActive("heading", { level: 3 }))}
        >
          H3
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().toggleHeading({ level: 4 }).run(); }}
          className={btnClass(isActive("heading", { level: 4 }))}
        >
          H4
        </button>
        <div className="w-px bg-border mx-1" />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().toggleBold().run(); }}
          className={`${btnClass(isActive("bold"))} font-bold`}
        >
          G
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().toggleItalic().run(); }}
          className={`${btnClass(isActive("italic"))} italic`}
        >
          I
        </button>
        <div className="w-px bg-border mx-1" />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); addLink(); }}
          className={btnClass(isActive("link"))}
        >
          Lien
        </button>
        {isActive("link") && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); editor.chain().unsetLink().run(); }}
            className="px-2 py-1 rounded text-xs hover:bg-muted text-destructive"
          >
            Suppr. lien
          </button>
        )}
        <div className="w-px bg-border mx-1" />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().toggleBulletList().run(); }}
          className={btnClass(isActive("bulletList"))}
        >
          Liste
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().toggleOrderedList().run(); }}
          className={btnClass(isActive("orderedList"))}
        >
          1. Liste
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().toggleBlockquote().run(); }}
          className={btnClass(isActive("blockquote"))}
        >
          Citation
        </button>
        <div className="w-px bg-border mx-1" />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); triggerImagePicker(); }}
          className={btnBase}
          disabled={uploadingImage}
          title="Insérer une image dans le texte (5 MB max, convertie en AVIF)"
        >
          {uploadingImage ? "Upload…" : "Image"}
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); addTable(); }}
          className={btnBase}
        >
          Tableau
        </button>
        <div className="w-px bg-border mx-1" />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); triggerWordPicker(); }}
          className={btnBase}
          disabled={importingWord}
          title="Importer un document Word (.docx) avec sa mise en forme : titres, listes, tableaux"
        >
          {importingWord ? "Import…" : "Import Word"}
        </button>
        <input
          ref={wordInputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleWordImport}
          className="hidden"
        />
        {isActive("table") && (
          <>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().addColumnAfter().run(); }}
              className={btnBase}
            >
              + Col
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().addRowAfter().run(); }}
              className={btnBase}
            >
              + Ligne
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().deleteColumn().run(); }}
              className="px-2 py-1 rounded text-xs hover:bg-muted text-destructive"
            >
              - Col
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().deleteRow().run(); }}
              className="px-2 py-1 rounded text-xs hover:bg-muted text-destructive"
            >
              - Ligne
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().deleteTable().run(); }}
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
        .tiptap ul {
          list-style: disc outside;
        }
        .tiptap ol {
          list-style: decimal outside;
        }
        .tiptap li {
          margin-bottom: 0.25em;
        }
        .tiptap li > p {
          margin-bottom: 0;
        }
        .tiptap blockquote {
          border-left: 3px solid #E35205;
          padding-left: 1em;
          margin: 1em 0;
          color: #6b7280;
        }
        .tiptap a {
          color: #E35205 !important;
          text-decoration: underline !important;
          text-underline-offset: 2px;
          cursor: text;
        }
        .tiptap img {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 1.25em 0;
        }
        .tiptap img.ProseMirror-selectednode {
          outline: 3px solid #E35205;
          outline-offset: 2px;
        }
      `}</style>
      <EditorContent
        editor={editor}
        className="max-w-none px-4 py-3 min-h-[300px] focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[280px] text-sm"
      />
    </div>
  );
}
