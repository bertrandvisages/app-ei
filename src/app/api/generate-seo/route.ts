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
  if (!body) {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const rawType = body.type === "opinion" || body.type === "author" ? body.type : "dossier";
  const type = rawType as "dossier" | "opinion" | "author";

  // Strip HTML, normalise espaces, plafonne (cap court pour les auteurs)
  const stripHtml = (s: string, cap: number) =>
    s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, cap);

  // Construit le bloc "contexte" envoyé à Gemini selon le type.
  let promptIntro: string;
  let promptInputs: string;

  if (type === "author") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    }
    const jobTitle = typeof body.job_title === "string" ? body.job_title.trim() : "";
    const company = typeof body.company === "string" ? body.company.trim() : "";
    const bio = typeof body.bio === "string" ? stripHtml(body.bio, 3000) : "";

    promptIntro = `Tu es expert SEO pour Le Non Coté (lenoncote.fr), publication française spécialisée dans l'investissement non coté (private equity, capital-risque, growth, entrepreneurs investis). Tu vas optimiser le SEO d'une page AUTEUR — c'est la page de profil d'un contributeur expert du média.`;
    promptInputs = `NOM : ${name}${jobTitle ? `\nFONCTION : ${jobTitle}` : ""}${company ? `\nENTREPRISE : ${company}` : ""}${bio ? `\n\nBIO :\n${bio}` : ""}`;
  } else {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "Titre requis" }, { status: 400 });
    }
    const title = body.title.trim();
    const content = typeof body.content === "string" ? body.content : "";
    const plainContent = stripHtml(content, 6000);

    const typeLabel = type === "opinion" ? "une opinion (édito)" : "un dossier";
    const typeContext =
      type === "opinion"
        ? "C'est une tribune éditoriale, signée par un expert."
        : "C'est un dossier d'analyse approfondi sur un sujet d'investissement.";

    promptIntro = `Tu es expert SEO pour Le Non Coté (lenoncote.fr), publication française spécialisée dans l'investissement non coté (private equity, capital-risque, growth, entrepreneurs investis). Tu vas optimiser le SEO de ${typeLabel}. ${typeContext}`;
    promptInputs = `TITRE INTERNE : ${title}\n\nCONTENU :\n${plainContent}`;
  }

  // Règles spécifiques au type pour le title et la description.
  const titleHint =
    type === "author"
      ? `- Mentionne le NOM de l'auteur et son angle d'expertise (private equity, capital-risque, family office, etc.)
- Pas "Profil de …" ni "Auteur :" : formuler comme un titre de page utile (ex. "Nom Prenom, expert capital-risque" ou similaire)`
      : `- Contient le mot-clé principal du sujet en début si possible
- Différent du titre interne : reformule pour optimiser le SERP`;

  const descHint =
    type === "author"
      ? `- Présente la valeur ajoutée des contenus de cet auteur pour le lecteur (son angle, ses sujets de prédilection, son expertise)
- Mentionne sa fonction ou son entreprise si c'est pertinent`
      : `- Décrit la valeur ajoutée du contenu pour le lecteur (ce qu'il va apprendre / décider)
- Contient le mot-clé principal mais formulé autrement que dans le title`;

  const prompt = `${promptIntro}

${promptInputs}

Ta mission : produire un TITRE SEO et une META DESCRIPTION optimisés pour Google et les réseaux sociaux. Contraintes impératives :

SEO TITLE :
- Entre 50 et 60 caractères (jamais plus de 60, jamais moins de 45)
${titleHint}
- Accrocheur mais professionnel (ton institutionnel/expert, pas clickbait)
- Pas de point final, pas de guillemets, pas d'emoji
- Ne pas mentionner "Le Non Coté" (déjà ajouté côté template)
- DOIT être une phrase ou syntagme COMPLET, jamais coupé en plein milieu

META DESCRIPTION :
- Entre 140 et 160 caractères (jamais plus de 160, jamais moins de 130)
- Doit être un texte ENTIÈREMENT DIFFÉRENT du seo_title : ne reprend pas mot pour mot la phrase du titre
${descHint}
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
  //
  // Couper au dernier espace ne casse jamais un mot, mais ça tronque la
  // phrase. « Entrepreneurs et private equity : une relation en pleine » et
  // « Liquidité du non coté : gérer l'illiquidité en private » sont partis en
  // production comme ça : dans un résultat Google, ils se lisent comme une
  // page cassée.
  //
  // On recule donc jusqu'à une fin de groupe. Un mot-outil en dernière
  // position ne tient pas tout seul. Une préposition en avant-dernière
  // position introduit un complément qu'on vient justement de couper, donc on
  // retire les deux. Un déterminant, lui, forme un groupe complet avec le nom
  // qui le suit (« une relation »), on n'y touche pas.
  const ORPHELINS = new Set([
    "a", "au", "aux", "avec", "ce", "ces", "cet", "cette", "chez", "contre",
    "dans", "de", "des", "donc", "dont", "du", "en", "entre", "et", "la", "le",
    "les", "leur", "leurs", "ma", "mais", "mes", "moins", "mon", "ni", "nos",
    "notre", "ou", "par", "plus", "pour", "pres", "qui", "que", "sa", "sans",
    "se", "selon", "ses", "son", "sous", "sur", "ta", "tes", "ton", "tres",
    "un", "une", "vers", "vos", "votre",
  ]);
  // Volontairement sans « de », « des » ni « du » : ils forment un groupe
  // complet avec le nom qui suit (« la carte des deals »), comme un
  // déterminant. Les retirer amputait la phrase au lieu de la rétablir.
  const PREPOSITIONS = new Set([
    "a", "au", "aux", "avec", "chez", "contre", "dans",
    "en", "entre", "par", "pour", "pres", "sans", "selon", "sous", "sur", "vers",
  ]);
  const mot = (w: string) =>
    w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z']/g, "");

  const trim = (s: string, max: number) => {
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    const lastSpace = cut.lastIndexOf(" ");
    const mots = (lastSpace > max - 15 ? cut.slice(0, lastSpace) : cut).trim().split(/\s+/);

    // On ne descend pas sous 4 mots : en dessous, le texte perdrait le mot
    // clé, ce qui est pire qu'une formule un peu sèche.
    while (mots.length > 4) {
      const dernier = mots[mots.length - 1];
      if (ORPHELINS.has(mot(dernier))) { mots.pop(); continue; }
      // Une majuscule signale un nom propre : « en France », « chez
      // Bpifrance » sont des groupes complets, on les garde.
      const nomPropre = /^[A-ZÀ-Þ]/.test(dernier);
      if (!nomPropre && PREPOSITIONS.has(mot(mots[mots.length - 2]))) { mots.splice(-2); continue; }
      break;
    }
    // Ponctuation laissée orpheline par la coupe.
    return mots.join(" ").replace(/[\s,;:.–-]+$/, "").trim();
  };

  return NextResponse.json({
    seo_title: trim(cleanTitle, 60),
    seo_description: trim(cleanDesc, 160),
  });
}
