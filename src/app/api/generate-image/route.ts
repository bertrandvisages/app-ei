import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "media";
const MODEL = "gemini-3-pro-image-preview";

// Génère une image via Gemini 3 Pro Image et l'upload dans Supabase Storage.
// Body : { prompt: string, folder?: string, aspectRatio?: '16:9' | '1:1' | '4:3' | ... }
// Réponse : { url: string, path: string, prompt: string }
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY non configurée côté serveur" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.prompt !== "string" || !body.prompt.trim()) {
    return NextResponse.json({ error: "Prompt requis" }, { status: 400 });
  }

  const prompt = body.prompt.trim();
  const folder = (typeof body.folder === "string" && body.folder) || "generated";
  const aspectRatio = body.aspectRatio || "16:9";

  // ─── Appel Gemini ──────────────────────────────────────
  let geminiRes: Response;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            responseFormat: {
              image: { aspectRatio, imageSize: "2K" },
            },
          },
        }),
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: `Erreur réseau Gemini : ${
          err instanceof Error ? err.message : "inconnue"
        }`,
      },
      { status: 502 }
    );
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text().catch(() => "");
    return NextResponse.json(
      { error: `Gemini ${geminiRes.status} : ${errText.slice(0, 200)}` },
      { status: 502 }
    );
  }

  // ─── Extraire l'image base64 ───────────────────────────
  type GeminiResp = {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string };
        }>;
      };
    }>;
  };
  const data = (await geminiRes.json()) as GeminiResp;
  const imagePart = data.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.data
  );
  if (!imagePart || !imagePart.inlineData?.data) {
    return NextResponse.json(
      { error: "Gemini n'a pas renvoyé d'image (peut-être bloquée par les safety filters)." },
      { status: 502 }
    );
  }

  const buffer = Buffer.from(imagePart.inlineData.data, "base64");
  const ext = (imagePart.inlineData.mimeType || "image/png")
    .replace("image/", ".")
    .replace(".jpeg", ".jpg");

  const ts = Date.now();
  const path = `${folder}/${ts}.${ext.replace(/^\./, "")}`;

  // ─── Upload Storage ───────────────────────────────────
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: imagePart.inlineData.mimeType || "image/png",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({
    url: publicUrl,
    path,
    prompt,
  });
}
