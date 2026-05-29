import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Proxy de download des pieces jointes d'une demande de contribution.
// Force Content-Disposition: attachment avec le nom original du fichier
// pour que le navigateur telecharge au lieu d'afficher inline (cas des
// PDF/images qui s'ouvraient dans l'onglet sans option de DL native).
//
// GET /api/contribution-requests/attachment?id=<row_id>&index=<idx>

type Attachment = {
  name: string;
  url: string;
  content_type: string;
  size_bytes: number;
};

function extractStoragePath(publicUrl: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(publicUrl);
    // Format : /storage/v1/object/public/<bucket>/<path...>
    const m = u.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const indexStr = searchParams.get("index");
  if (!id || !indexStr) {
    return NextResponse.json({ error: "id et index requis" }, { status: 400 });
  }
  const index = parseInt(indexStr, 10);
  if (!Number.isFinite(index) || index < 0) {
    return NextResponse.json({ error: "index invalide" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("contribution_requests")
    .select("attachments")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

  const attachments = (row.attachments as Attachment[]) ?? [];
  const att = attachments[index];
  if (!att) {
    return NextResponse.json({ error: "Pièce jointe introuvable" }, { status: 404 });
  }

  const loc = extractStoragePath(att.url);
  if (!loc) {
    return NextResponse.json({ error: "URL stockée invalide" }, { status: 500 });
  }

  // On telecharge le fichier depuis Storage. La session authenticated peut
  // lire car le bucket media a une policy authenticated read (et public read
  // de toute facon — on passe par l'API pour pouvoir forcer Content-Disposition).
  const { data: blob, error: dlErr } = await supabase.storage
    .from(loc.bucket)
    .download(loc.path);
  if (dlErr || !blob) {
    return NextResponse.json(
      { error: `Téléchargement échoué : ${dlErr?.message || "blob vide"}` },
      { status: 502 }
    );
  }

  const buffer = Buffer.from(await blob.arrayBuffer());

  // RFC 6266 — filename* pour les caracteres non-ASCII (UTF-8), filename
  // en fallback pour les vieux clients.
  const utf8Name = encodeURIComponent(att.name);
  const asciiName = att.name.replace(/[^\x20-\x7E]/g, "_");

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": att.content_type || "application/octet-stream",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      "Cache-Control": "private, no-store",
    },
  });
}
