import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MODEL = "gemini-2.5-flash";

// Extrait une citation accrocheuse à partir du titre + contenu d'un édito.
// Body : { title: string, content?: string }
// Réponse : { citation: string }
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
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Titre requis" }, { status: 400 });
  }

  const title = body.title.trim();
  const content = typeof body.content === "string" ? body.content : "";
  const plainContent = content
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);

  const prompt = `Tu es éditeur d'une publication française sur l'investissement non coté. Voici un édito.

TITRE : ${title}

CONTENU :
${plainContent}

Ta mission : extraire une CITATION (pull-quote) directement tirée du contenu, idéale pour la carte publique. Contraintes impératives :
- DE 1 à 4 phrases complètes (selon ce qui rend le mieux pour l'édito)
- TOUJOURS commencer par une majuscule et TOUJOURS finir par un point/point d'exclamation/point d'interrogation (jamais "…")
- JAMAIS de phrase tronquée
- Doit être autoporteuse (compréhensible sans le contexte)
- Ton éditorial, percutant, pas trop technique
- Pas de guillemets autour, pas de markdown, pas de préambule du type "Voici la citation :"
- Français correct, typographie soignée (espaces insécables avant : ; ! ?)

Réponds uniquement avec la citation, rien d'autre.`;

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
            temperature: 0.7,
            maxOutputTokens: 400,
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

  type GeminiResp = {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const data = (await geminiRes.json()) as GeminiResp;
  const raw = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
  if (!raw) {
    return NextResponse.json(
      { error: "Gemini n'a pas renvoyé de texte." },
      { status: 502 }
    );
  }

  // Nettoyage : trim, retirer les guillemets éventuels autour, normaliser espaces
  let citation = raw.trim();
  citation = citation.replace(/^["'«»]+|["'«»]+$/g, "").trim();
  citation = citation.replace(/\s+/g, " ");

  // Pas de troncature : on laisse la phrase complète, même si > 280 chars.
  // Si vraiment trop long (>500), on coupe à la dernière phrase complète.
  if (citation.length > 500) {
    const cut = citation.slice(0, 500);
    const lastEnd = Math.max(
      cut.lastIndexOf("."),
      cut.lastIndexOf("!"),
      cut.lastIndexOf("?")
    );
    citation = lastEnd > 0 ? cut.slice(0, lastEnd + 1) : cut;
  }

  return NextResponse.json({ citation });
}
