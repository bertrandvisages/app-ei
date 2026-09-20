import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { THEMES, SUJETS } from "@/lib/taxonomy";

const MODEL = "gemini-2.5-flash";

// Suggère un classement matriciel (theme + sujet) pour un dossier, CONTRAINT aux
// listes fermées de src/lib/taxonomy.ts (responseSchema enum + validation).
// Body : { title: string, content?: string } → { theme: string|null, sujet: string|null }
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

  const themeValues = THEMES.map((t) => t.value);
  const sujetValues = SUJETS.map((s) => s.value);
  const themeList = THEMES.map((t) => `- ${t.value} : ${t.label}`).join("\n");
  const sujetList = SUJETS.map((s) => `- ${s.value} : ${s.label}`).join("\n");

  const prompt = `Tu classes un dossier d'une publication française sur l'investissement non coté selon DEUX axes indépendants.

TITRE : ${title}

CONTENU :
${plainContent}

AXE 1 — SUJET (l'univers traité), choisis UNE seule valeur :
${sujetList}
Règles sujet :
- actifs_alternatifs = crypto, financement de contentieux (litigation) et niches hors private equity / dette privée / infrastructure / immobilier.
- entrepreneuriat = l'entreprise et ses dirigeants (transmission, intrapreneuriat, regard des entrepreneurs) — l'économie réelle, PAS une classe d'actifs.
- transversal = couvre le non coté en général, sans classe d'actifs dominante.

AXE 2 — THEME (l'angle éditorial), choisis UNE seule valeur :
${themeList}
Règles thème :
- comprendre = pédagogie / expliquer un mécanisme
- marche = état des lieux, tendances, chiffres, prospective
- choisir = méthode, critères, évaluer, comparer
- fiscalite = fiscalité et enveloppes (PER, assurance-vie, avantages fiscaux)
- gerer = gérer / suivre son investissement (liquidité, marché secondaire)
- regards = interview, opinion, point de vue, portrait

Choisis la valeur DOMINANTE pour chaque axe. Réponds uniquement en JSON.`;

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
            temperature: 0,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                sujet: { type: "string", enum: sujetValues },
                theme: { type: "string", enum: themeValues },
              },
              required: ["sujet", "theme"],
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

  type GeminiResp = {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    }>;
  };
  const data = (await geminiRes.json()) as GeminiResp;
  const raw = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("")
    .trim();

  let parsed: { theme?: string; sujet?: string } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Réponse Gemini illisible" },
      { status: 502 }
    );
  }

  // Validation défensive : on ne renvoie que des valeurs de la liste fermée.
  const theme = (themeValues as readonly string[]).includes(parsed.theme ?? "")
    ? parsed.theme
    : null;
  const sujet = (sujetValues as readonly string[]).includes(parsed.sujet ?? "")
    ? parsed.sujet
    : null;

  return NextResponse.json({ theme, sujet });
}
