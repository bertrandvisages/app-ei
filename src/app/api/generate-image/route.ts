import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toAvif } from "@/lib/image";

const BUCKET = "media";
const MODEL = "gemini-3-pro-image-preview";
// Modèle texte pour synthétiser l'article en brief visuel (cf. generate-citation).
const BRIEF_MODEL = "gemini-2.5-flash";

// ─── Préfixe photo réaliste (cf. AGENTS.md du projet lenoncote) ───
const PHOTO_REALISM_PREFIX =
  "Photojournalism style, shot on Sony A7R IV with a 50mm lens equivalent, 5500K white balance, mild lens vignetting, realistic depth of field, late afternoon golden hour lighting, slight atmospheric haze, low contrast natural lighting. No CGI, no 3D render, no maquette look, raw photo realism, no text in the image, no logos.";

// ─── Contrainte de propreté / standing ───
// Gemini a tendance a "salir" les scenes (murs sales, sportifs couverts de
// boue...). On impose des sujets et decors propres et haut de gamme.
const CLEANLINESS_CONSTRAINT =
  "Clean, polished, premium and pristine — every subject, surface, garment and setting is spotless and well-kept. No dirt, no mud, no dust, no stains, no sweat grime, no rust, no litter, no peeling paint, no run-down or shabby surroundings. Tasteful, refined, editorial quality.";

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

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ─── Synthèse visuelle ───
// On demande à Gemini Flash de dégager LE message central de l'article (surtout
// d'après le titre, puis le texte) et de le traduire en UNE scène photographique
// concrète — une analogie visuelle parlante, dans l'esprit du style choisi.
// Renvoie le brief (en anglais, pour le modèle d'image) ou null si l'appel échoue
// → on retombe alors sur l'ancien comportement (template de style + extrait brut).
async function synthesizeVisualBrief({
  title,
  content,
  style,
  apiKey,
}: {
  title: string;
  content?: string;
  style: string;
  apiKey: string;
}): Promise<string | null> {
  const styleHint =
    STYLE_TEMPLATES[style] || STYLE_TEMPLATES["corporate-elegant"];
  const plain = content ? stripHtml(content).slice(0, 6000) : "";

  const prompt = `Tu es directeur artistique pour une publication française de private equity / investissement non coté. On génère une image de couverture éditoriale photoréaliste pour cet article.

TITRE (source PRINCIPALE, la plus importante) : ${title}
${plain ? `TEXTE (source secondaire) :\n${plain}` : ""}

STYLE VISUEL IMPOSÉ : ${styleHint}

Ta mission : dégager LE message central de l'article — en t'appuyant SURTOUT sur le titre, puis sur le texte — et le traduire en UNE scène photographique concrète : une ANALOGIE VISUELLE parlante qui illustre ce message, pas une illustration littérale ni un schéma financier.

Contraintes IMPÉRATIVES :
- UNE seule scène concrète, cadrage et sujet clairs, en 2 à 3 phrases.
- Reste fidèle à l'esprit du STYLE VISUEL IMPOSÉ ci-dessus.
- Sujet, vêtements et décor PROPRES, soignés, haut de gamme : aucune saleté, boue, poussière, tache, sueur, rouille, ni environnement délabré ou négligé.
- Pas de texte ni de logo dans l'image.
- Réponds en ANGLAIS (c'est un prompt pour un modèle d'image), uniquement la description de la scène, sans préambule ni guillemets.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${BRIEF_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 600,
            // thinkingBudget 0 : sinon le "thinking" consomme les tokens avant
            // le texte final (cf. generate-citation).
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );
    if (!res.ok) return null;
    type Resp = {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string; thought?: boolean }> };
      }>;
    };
    const data = (await res.json()) as Resp;
    const brief = (data.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text as string)
      .join(" ")
      .replace(/^["'«»]+|["'«»]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return brief || null;
  } catch {
    return null;
  }
}

function buildPrompt({
  title,
  brief,
  content,
  style,
}: {
  title: string;
  brief: string | null;
  content?: string;
  style: string;
}): string {
  // Scène : le brief synthétisé si dispo, sinon fallback template de style +
  // extrait brut de l'article (ancien comportement).
  let scene: string;
  if (brief) {
    scene = brief;
  } else {
    const template =
      STYLE_TEMPLATES[style] || STYLE_TEMPLATES["corporate-elegant"];
    const hint = content
      ? ` Article topic context (for inspiration, not literal text): ${stripHtml(content)}`
      : "";
    scene = `${template}${hint}`;
  }
  return `Editorial cover image for a French private equity / finance publication titled "${title}". Scene: ${scene} ${CLEANLINESS_CONSTRAINT} ${PHOTO_REALISM_PREFIX}`.trim();
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
    const title = body.title.trim();
    const content = typeof body.content === "string" ? body.content : undefined;
    // Étape 1 : synthèse de l'article en brief visuel (analogie). Si l'appel
    // échoue, brief = null et buildPrompt retombe sur le template de style.
    const brief = await synthesizeVisualBrief({
      title,
      content,
      style: body.style,
      apiKey,
    });
    prompt = buildPrompt({ title, brief, content, style: body.style });
  } else {
    return NextResponse.json(
      { error: "Body doit contenir soit { prompt }, soit { title, style }" },
      { status: 400 }
    );
  }

  const folder = (typeof body.folder === "string" && body.folder) || "generated";
  const aspectRatio = body.aspectRatio || "16:9";

  // ─── Appel Gemini ──────────────────────────────────────
  // Note : la config responseFormat.image.aspectRatio cause un 400 dans la version
  // actuelle de l'API gemini-3-pro-image-preview (enum non documenté).
  // On l'enlève et on injecte la contrainte d'aspect dans le prompt lui-même.
  const promptWithAspect = `${prompt}\n\nFormat de sortie : image en aspect ratio ${aspectRatio}, paysage.`;

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
          contents: [{ parts: [{ text: promptWithAspect }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
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

  const geminiBuffer = Buffer.from(imagePart.inlineData.data, "base64");
  const geminiMime = imagePart.inlineData.mimeType || "image/png";

  // Conversion en AVIF (qualité 60) avant upload pour éviter de stocker des
  // PNG de 1-3 MB. Fallback transparent sur le PNG d'origine si sharp échoue.
  const encoded = await toAvif(geminiBuffer, geminiMime);

  const ts = Date.now();
  const path = `${folder}/${ts}.${encoded.ext}`;

  // ─── Upload Storage ───────────────────────────────────
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
    url: publicUrl,
    path,
    prompt,
  });
}
