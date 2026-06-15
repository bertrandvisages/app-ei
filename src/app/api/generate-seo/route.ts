import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MODEL = "gemini-2.5-flash";

// Génère un titre SEO et une meta description à partir du titre et du contenu
// d'un dossier ou d'une opinion. Réservé aux admins.
//
// Body : { title: string, content?: string, type?: 'dossier' | 'opinion' }
// Réponse : { seo_title: string, seo_description: string }
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Admin-only
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
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
  const type: "dossier" | "opinion" =
    body.type === "opinion" ? "opinion" : "dossier";

  // Strip HTML, normalise espaces, plafonne à 6000 chars
  const plainContent = content
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);

  const typeLabel = type === "opinion" ? "une opinion (édito)" : "un dossier";
  const typeContext =
    type === "opinion"
      ? "C'est une tribune éditoriale, signée par un expert."
      : "C'est un dossier d'analyse approfondi sur un sujet d'investissement.";

  const prompt = `Tu es expert SEO pour Le Non Coté (lenoncote.fr), publication française spécialisée dans l'investissement non coté (private equity, capital-risque, growth, entrepreneurs investis). Tu vas optimiser le SEO de ${typeLabel}. ${typeContext}

TITRE INTERNE : ${title}

CONTENU :
${plainContent}

Ta mission : produire un TITRE SEO et une META DESCRIPTION optimisés pour Google et les réseaux sociaux. Contraintes impératives :

SEO TITLE :
- Entre 50 et 60 caractères (jamais plus de 60, jamais moins de 45)
- Contient le mot-clé principal du sujet en début si possible
- Accrocheur mais professionnel (ton institutionnel/expert, pas clickbait)
- Différent du titre interne : reformule pour optimiser le SERP
- Pas de point final, pas de guillemets, pas d'emoji
- Ne pas mentionner "Le Non Coté" (déjà ajouté côté template)
- DOIT être une phrase ou syntagme COMPLET, jamais coupé en plein milieu

META DESCRIPTION :
- Entre 140 et 160 caractères (jamais plus de 160, jamais moins de 130)
- Doit être un texte ENTIÈREMENT DIFFÉRENT du seo_title : ne reprend pas mot pour mot la phrase du titre
- Décrit la valeur ajoutée du contenu pour le lecteur (ce qu'il va apprendre / décider)
- Contient le mot-clé principal mais formulé autrement que dans le title
- Incite à cliquer sans être racoleur (verbe à l'infinitif ou impératif doux)
- Finit par un point
- Pas de "Découvrez", "Cliquez ici", "Lisez notre article" (banni car cliché SEO)
- Français impeccable, typographie soignée (espaces insécables avant : ; ! ?)
- DOIT être une phrase complète qui se termine par un point, jamais coupée en plein milieu

Réponds UNIQUEMENT avec un JSON valide de la forme :
{"seo_title": "…", "seo_description": "…"}
Aucun texte avant ou après le JSON, pas de markdown, pas de code fence.`;

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
            temperature: 0.6,
            // Volontairement très large : avec responseSchema activé, si on
            // hit le plafond Gemini clôt le JSON en tronquant les deux
            // strings au même endroit (bug observé à 800 tokens : title et
            // description identiques et coupées en plein mot).
            maxOutputTokens: 4000,
            // Désactive le "thinking" interne de gemini-2.5-flash (cf. generate-citation).
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                seo_title: { type: "string" },
                seo_description: { type: "string" },
              },
              required: ["seo_title", "seo_description"],
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
      finishReason?: string;
    }>;
  };
  const data = (await geminiRes.json()) as GeminiResp;
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const raw = parts
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("")
    .trim();

  if (!raw) {
    return NextResponse.json(
      {
        error: `Gemini n'a pas renvoyé de texte (finishReason: ${
          data.candidates?.[0]?.finishReason ?? "n/a"
        }).`,
      },
      { status: 502 }
    );
  }

  let parsed: { seo_title?: unknown; seo_description?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Réponse Gemini non JSON" },
      { status: 502 }
    );
  }

  const cleanTitle = String(parsed.seo_title ?? "")
    .trim()
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .replace(/\s+/g, " ");
  const cleanDesc = String(parsed.seo_description ?? "")
    .trim()
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .replace(/\s+/g, " ");

  if (!cleanTitle || !cleanDesc) {
    return NextResponse.json(
      { error: "Gemini n'a pas renvoyé de title/description valides" },
      { status: 502 }
    );
  }

  // Garde-fou : si les deux strings sont identiques (ou si l'une est strictement
  // préfixe de l'autre), c'est qu'on est tombé sur le bug de troncature
  // synchronisée du responseSchema. On demande à l'utilisateur de relancer.
  if (
    cleanTitle === cleanDesc ||
    cleanDesc.startsWith(cleanTitle) ||
    cleanTitle.startsWith(cleanDesc)
  ) {
    return NextResponse.json(
      {
        error:
          "Gemini a renvoyé un title et une description identiques (probablement tronqués). Relance la génération.",
      },
      { status: 502 }
    );
  }

  // Garde-fous longueur : on garde les valeurs en l'état mais on coupe
  // proprement si Gemini dépasse (rare avec le prompt actuel).
  const trim = (s: string, max: number) => {
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > max - 15 ? cut.slice(0, lastSpace) : cut).trim();
  };

  return NextResponse.json({
    seo_title: trim(cleanTitle, 60),
    seo_description: trim(cleanDesc, 160),
  });
}
