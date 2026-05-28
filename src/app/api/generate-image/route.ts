import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "media";
const MODEL = "gemini-3-pro-image-preview";

// ─── Préfixe photo réaliste (cf. AGENTS.md du projet lenoncote) ───
const PHOTO_REALISM_PREFIX =
  "Photojournalism style, shot on Sony A7R IV with a 50mm lens equivalent, 5500K white balance, mild lens vignetting, realistic depth of field, late afternoon golden hour lighting, slight atmospheric haze, low contrast natural lighting, visible weathered texture. No CGI, no 3D render, no maquette look, raw photo realism, no text in the image, no logos.";

// ─── Templates de scène par style ───
const STYLE_TEMPLATES: Record<string, string> = {
  "corporate-elegant":
    "An elegant corporate scene — modern French private equity office, executive in tailored suit, soft natural light through large windows, polished wood and brass details.",
  "analogie-sportive":
    "A high-stakes sports metaphor for finance — endurance, precision, teamwork. Athletes mid-action, intense focus, professional sport setting.",
  "metaphore-nature":
    "A natural metaphor for growth and resilience — old-growth forest, mountain ridge, or coastal landscape evoking long-term value creation.",
  "industriel-terrain":
    "An industrial / on-the-ground scene — factory floor, logistics hub, port crane, or workshop. Real workers, real equipment, no staging.",
  "abstrait-data":
    "An abstract editorial illustration of financial data — geometric overlays, light trails, layered transparent planes, restrained color palette.",
  "architecture-infrastructure":
    "Modern infrastructure — bridge, glass-and-steel building, transport hub. Architectural photography, strong lines, dramatic perspective.",
  "equipe-humain":
    "A small group of professionals working together — diverse French team, candid moment of discussion or decision, professional but warm.",
  "echiquier-strategie":
    "A strategy metaphor — chess pieces on a board, hand making a move, top-down view, dramatic spotlight on the focal piece.",
  "exploration-aventure":
    "An exploration / pioneering metaphor — explorer studying a map, ship navigating fog, expedition team at a vantage point.",
  "coffre-fort-patrimoine":
    "A wealth-preservation scene — bank vault door, safety deposit boxes, leather-bound ledgers, restrained luxury, low-key lighting.",
};

function buildPrompt({
  title,
  content,
  style,
}: {
  title: string;
  content?: string;
  style: string;
}): string {
  const scene = STYLE_TEMPLATES[style] || STYLE_TEMPLATES["corporate-elegant"];
  const contentHint = content
    ? `Article topic context (for inspiration, not literal text): ${content.replace(/<[^>]+>/g, "").slice(0, 400)}`
    : "";
  return `Editorial cover image for a French private equity / finance publication titled "${title}". ${scene} ${contentHint} ${PHOTO_REALISM_PREFIX}`.trim();
}

// Body accepté :
//   { title, content?, style, folder?, aspectRatio? }  ← nouveau flow style
//   { prompt, folder?, aspectRatio? }                  ← fallback prompt libre
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
  if (!body) {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  // Construction du prompt
  let prompt: string;
  if (typeof body.prompt === "string" && body.prompt.trim()) {
    prompt = body.prompt.trim();
  } else if (typeof body.title === "string" && typeof body.style === "string") {
    if (!body.title.trim()) {
      return NextResponse.json({ error: "Titre vide" }, { status: 400 });
    }
    prompt = buildPrompt({
      title: body.title.trim(),
      content: typeof body.content === "string" ? body.content : undefined,
      style: body.style,
    });
  } else {
    return NextResponse.json(
      { error: "Body doit contenir soit { prompt }, soit { title, style }" },
      { status: 400 }
    );
  }

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
  const mime = imagePart.inlineData.mimeType || "image/png";
  const ext = mime === "image/jpeg" ? "jpg" : mime.replace("image/", "") || "png";

  const ts = Date.now();
  const path = `${folder}/${ts}.${ext}`;

  // ─── Upload Storage ───────────────────────────────────
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: mime,
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
