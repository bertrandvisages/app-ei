import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toAvif, replaceExt } from "@/lib/image";

const BUCKET = "media";

// Sanitize un nom de fichier : lowercase, ascii uniquement, garde l'extension
function sanitizeFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";
  const safeBase = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${safeBase || "file"}${ext}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string | null) || "uploads";

  if (!file) {
    return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Seules les images sont acceptées" },
      { status: 400 }
    );
  }

  const originalBuffer = Buffer.from(await file.arrayBuffer());

  // Conversion en AVIF (qualité 60) avant upload. SVG et formats non
  // transcodables passent en pass-through. En cas d'erreur sharp, fallback
  // transparent sur le buffer d'origine.
  const encoded = await toAvif(originalBuffer, file.type);

  // Path : <folder>/<timestamp>-<filename>, l'extension reflète l'encoding réel
  const ts = Date.now();
  const safeName = replaceExt(sanitizeFilename(file.name), encoded.ext);
  const path = `${folder}/${ts}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, encoded.buffer, {
      contentType: encoded.mime,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({
    id: 0, // pas de notion d'id numérique en Storage (compat front)
    url: publicUrl,
    path,
  });
}
