// Schémas des champs éditables par page statique.
//
// Chaque page expose un array de fields. Chaque field a :
//   - key : chemin pointé stocké dans pages.content JSONB (ex: "hero.eyebrow",
//           "droits.0.body", "faqs.2.q")
//   - label : libellé affiché à l'éditeur dans le dashboard
//   - type : "input" | "textarea" — taille du champ dans le formulaire
//   - group : libellé de la section dans le formulaire (regroupement visuel)
//   - placeholder (optionnel) : valeur par défaut affichée en gris si l'éditeur
//     n'a rien saisi. Doit matcher la valeur "default" codée en dur dans le
//     .astro pour que l'éditeur sache ce que le site affichera s'il vide la
//     case.
//
// Le site Astro applique ces overrides via `pageText(content, key, default)`.
// Si l'éditeur vide une case, l'API stocke "" → fallback sur le default codé
// dans le .astro.

export type PageFieldType = "input" | "textarea";

export type PageField = {
  key: string;
  label: string;
  type: PageFieldType;
  group: string;
  placeholder?: string;
};

export type PageSchema = {
  slug: string;
  title: string;          // Affiché dans la liste du dashboard
  description: string;    // Pitch court de la page
  url: string;            // Lien pour aller voir la page sur le site
  fields: PageField[];
};

// ─── vos-droits ────────────────────────────────────────────────────
const VOS_DROITS: PageSchema = {
  slug: "vos-droits",
  title: "Vos droits",
  description: "Guide pratique — droits de l'investisseur (information, rétractation, réclamation, limites).",
  url: "/vos-droits",
  fields: [
    { group: "Hero", key: "hero.eyebrow", label: "Eyebrow (petit texte au-dessus du titre)", type: "input", placeholder: "Investisseur" },
    { group: "Hero", key: "hero.title", label: "Titre — partie en blanc", type: "input", placeholder: "Vos" },
    { group: "Hero", key: "hero.title_highlight", label: "Titre — partie en orange", type: "input", placeholder: "droits" },
    { group: "Hero", key: "hero.title_full", label: "Titre HTML (utilisé dans la balise <title> + onglet du navigateur)", type: "input", placeholder: "Vos droits en tant qu'investisseur" },
    { group: "Hero", key: "hero.subtitle", label: "Sous-titre (HTML autorisé)", type: "textarea", placeholder: "Connaître vos droits est essentiel pour investir en toute sérénité et savoir comment agir en cas de difficulté." },

    { group: "Intro + sommaire", key: "intro", label: "Paragraphe d'intro (HTML autorisé)", type: "textarea", placeholder: "Cette page présente les droits fondamentaux dont vous bénéficiez lorsque vous investissez..." },
    { group: "Intro + sommaire", key: "toc.0.label", label: "Sommaire — entrée 1", type: "input", placeholder: "Droit à l'information" },
    { group: "Intro + sommaire", key: "toc.1.label", label: "Sommaire — entrée 2", type: "input", placeholder: "Droit de rétractation" },
    { group: "Intro + sommaire", key: "toc.2.label", label: "Sommaire — entrée 3", type: "input", placeholder: "Droit de réclamation" },
    { group: "Intro + sommaire", key: "toc.3.label", label: "Sommaire — entrée 4", type: "input", placeholder: "Limites de la protection" },
    { group: "Intro + sommaire", key: "toc.4.label", label: "Sommaire — entrée 5 (FAQ)", type: "input", placeholder: "Questions fréquentes" },

    { group: "Droit n°1 (Information)", key: "droits.0.name", label: "Titre", type: "input", placeholder: "Droit à l'information" },
    { group: "Droit n°1 (Information)", key: "droits.0.body", label: "Body (HTML autorisé)", type: "textarea", placeholder: "Avant de vous engager..." },

    { group: "Droit n°2 (Rétractation)", key: "droits.1.name", label: "Titre", type: "input", placeholder: "Droit de rétractation" },
    { group: "Droit n°2 (Rétractation)", key: "droits.1.body", label: "Body (HTML autorisé)", type: "textarea", placeholder: "Pour certains produits financiers..." },

    { group: "Droit n°3 (Réclamation)", key: "droits.2.name", label: "Titre", type: "input", placeholder: "Droit de réclamation" },
    { group: "Droit n°3 (Réclamation)", key: "droits.2.body", label: "Body (HTML autorisé)", type: "textarea", placeholder: "Si vous rencontrez un problème..." },

    { group: "Droit n°4 (Limites)", key: "droits.3.name", label: "Titre", type: "input", placeholder: "Limites de la protection" },
    { group: "Droit n°4 (Limites)", key: "droits.3.body", label: "Body (HTML autorisé)", type: "textarea", placeholder: "Il est important de comprendre que la surveillance..." },

    { group: "FAQ", key: "faqs.0.q", label: "Q1 — Question", type: "input", placeholder: "Que faire si je ne comprends pas..." },
    { group: "FAQ", key: "faqs.0.a", label: "Q1 — Réponse", type: "textarea", placeholder: "Vous avez le droit de demander des explications..." },
    { group: "FAQ", key: "faqs.1.q", label: "Q2 — Question", type: "input", placeholder: "Puis-je récupérer mon argent..." },
    { group: "FAQ", key: "faqs.1.a", label: "Q2 — Réponse", type: "textarea", placeholder: "Cela dépend du produit souscrit..." },
    { group: "FAQ", key: "faqs.2.q", label: "Q3 — Question", type: "input", placeholder: "L'AMF peut-elle m'aider..." },
    { group: "FAQ", key: "faqs.2.a", label: "Q3 — Réponse", type: "textarea", placeholder: "Non, l'AMF ne rembourse pas..." },
  ],
};

// ─── evaluer-son-profil ────────────────────────────────────────────
// Pour ce 1er pilote on rend éditable : hero, intro, FAQ. Les cards complexes
// (horizons, objectifs) restent codées — à ajouter dans une passe ultérieure.
const EVALUER_SON_PROFIL: PageSchema = {
  slug: "evaluer-son-profil",
  title: "Évaluer son profil",
  description: "Guide pratique — auto-évaluation, horizon, objectifs (textes de base éditables, structures cards en code).",
  url: "/evaluer-son-profil",
  fields: [
    { group: "Hero", key: "hero.eyebrow", label: "Eyebrow", type: "input", placeholder: "Auto-évaluation" },
    { group: "Hero", key: "hero.title", label: "Titre — partie 1", type: "input", placeholder: "Évaluer son" },
    { group: "Hero", key: "hero.title_highlight", label: "Titre — partie en orange", type: "input", placeholder: "profil" },
    { group: "Hero", key: "hero.title_suffix", label: "Titre — partie après l'orange", type: "input", placeholder: "d'investisseur" },
    { group: "Hero", key: "hero.title_full", label: "Titre HTML (balise <title>)", type: "input", placeholder: "Évaluer son profil d'investisseur" },
    { group: "Hero", key: "hero.subtitle", label: "Sous-titre", type: "textarea", placeholder: "Connaître son profil pour investir en cohérence avec sa situation." },

    { group: "Intro", key: "intro", label: "Paragraphe d'intro (HTML autorisé)", type: "textarea", placeholder: "Avant d'investir dans le non coté..." },

    { group: "FAQ", key: "faqs.0.q", label: "Q1 — Question", type: "input" },
    { group: "FAQ", key: "faqs.0.a", label: "Q1 — Réponse", type: "textarea" },
    { group: "FAQ", key: "faqs.1.q", label: "Q2 — Question", type: "input" },
    { group: "FAQ", key: "faqs.1.a", label: "Q2 — Réponse", type: "textarea" },
    { group: "FAQ", key: "faqs.2.q", label: "Q3 — Question", type: "input" },
    { group: "FAQ", key: "faqs.2.a", label: "Q3 — Réponse", type: "textarea" },
    { group: "FAQ", key: "faqs.3.q", label: "Q4 — Question", type: "input" },
    { group: "FAQ", key: "faqs.3.a", label: "Q4 — Réponse", type: "textarea" },
  ],
};

// ─── comment-investir-concretement ─────────────────────────────────
const COMMENT_INVESTIR: PageSchema = {
  slug: "comment-investir-concretement",
  title: "Comment investir concrètement",
  description: "Guide pratique — modes d'investissement, supports, fiscalité (textes de base éditables, sections détaillées en code).",
  url: "/comment-investir-concretement",
  fields: [
    { group: "Hero", key: "hero.eyebrow", label: "Eyebrow", type: "input", placeholder: "Mode d'emploi" },
    { group: "Hero", key: "hero.title", label: "Titre — partie en blanc", type: "input", placeholder: "Comment investir" },
    { group: "Hero", key: "hero.title_highlight", label: "Titre — partie en orange", type: "input", placeholder: "concrètement" },
    { group: "Hero", key: "hero.title_full", label: "Titre HTML (balise <title>)", type: "input", placeholder: "Comment investir concrètement" },
    { group: "Hero", key: "hero.subtitle", label: "Sous-titre (HTML autorisé)", type: "textarea", placeholder: "<strong>Les étapes clés pour passer de l'intention à l'action.</strong>" },

    { group: "Intro", key: "intro", label: "Paragraphe d'intro (HTML autorisé)", type: "textarea", placeholder: "Vous souhaitez investir dans le non coté mais ne savez pas par où commencer..." },

    { group: "FAQ", key: "faqs.0.q", label: "Q1 — Question", type: "input" },
    { group: "FAQ", key: "faqs.0.a", label: "Q1 — Réponse", type: "textarea" },
    { group: "FAQ", key: "faqs.1.q", label: "Q2 — Question", type: "input" },
    { group: "FAQ", key: "faqs.1.a", label: "Q2 — Réponse", type: "textarea" },
    { group: "FAQ", key: "faqs.2.q", label: "Q3 — Question", type: "input" },
    { group: "FAQ", key: "faqs.2.a", label: "Q3 — Réponse", type: "textarea" },
    { group: "FAQ", key: "faqs.3.q", label: "Q4 — Question", type: "input" },
    { group: "FAQ", key: "faqs.3.a", label: "Q4 — Réponse", type: "textarea" },
  ],
};

// Registry public
export const PAGE_SCHEMAS: Record<string, PageSchema> = {
  [VOS_DROITS.slug]: VOS_DROITS,
  [EVALUER_SON_PROFIL.slug]: EVALUER_SON_PROFIL,
  [COMMENT_INVESTIR.slug]: COMMENT_INVESTIR,
};

export const PAGE_SLUGS = Object.keys(PAGE_SCHEMAS);
export function getPageSchema(slug: string): PageSchema | null {
  return PAGE_SCHEMAS[slug] ?? null;
}

// Helpers pour lire/écrire des clés pointées ("hero.eyebrow", "droits.0.body")
// dans un objet JSONB.

export function getDotted(obj: Record<string, unknown>, key: string): string {
  const parts = key.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return "";
    }
  }
  return typeof cur === "string" ? cur : "";
}

export function setDotted(
  obj: Record<string, unknown>,
  key: string,
  value: string
): Record<string, unknown> {
  const parts = key.split(".");
  // Deep clone uniquement la branche que l'on modifie pour ne pas muter l'input
  const next: Record<string, unknown> = { ...obj };
  let cur: Record<string, unknown> = next;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const existing = cur[p];
    const nextLayer =
      existing && typeof existing === "object" && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : Array.isArray(existing)
        ? [...existing]
        : {};
    cur[p] = nextLayer;
    cur = nextLayer as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
  return next;
}
