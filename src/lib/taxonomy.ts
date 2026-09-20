// Classification matricielle des dossiers (et à terme des opinions) :
// deux axes indépendants, listes fermées. Un dossier = une valeur par axe.
//
//  - THEME  = l'angle éditorial / l'intention de lecture
//  - SUJET  = l'univers traité (classe d'actifs, ou économie réelle, ou transversal)
//
// Source unique de vérité : le dashboard (menus déroulants) et, plus tard,
// les filtres à facettes du site public s'appuient dessus. Les valeurs
// (`value`) sont stockées telles quelles en base (colonnes dossiers.theme /
// dossiers.sujet, type text nullable — pas de contrainte SQL pour pouvoir
// ajouter un univers sans migration, cf. l'ajout récent d'« Actifs alternatifs »).

export const THEMES = [
  { value: "comprendre", label: "Comprendre" },
  { value: "marche", label: "Marché & tendances" },
  { value: "choisir", label: "Choisir & évaluer" },
  { value: "fiscalite", label: "Fiscalité & enveloppes" },
  { value: "gerer", label: "Gérer & suivre" },
  { value: "regards", label: "Regards & voix" },
] as const;

export const SUJETS = [
  { value: "private_equity", label: "Private Equity" },
  { value: "dette_privee", label: "Dette privée" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "immobilier", label: "Immobilier non coté" },
  { value: "actifs_alternatifs", label: "Actifs alternatifs" },
  { value: "entrepreneuriat", label: "Entrepreneuriat & économie réelle" },
  { value: "transversal", label: "Transversal / Non coté" },
] as const;

export type ThemeValue = (typeof THEMES)[number]["value"];
export type SujetValue = (typeof SUJETS)[number]["value"];

export const themeLabel = (v?: string | null): string | null =>
  THEMES.find((t) => t.value === v)?.label ?? null;

export const sujetLabel = (v?: string | null): string | null =>
  SUJETS.find((s) => s.value === v)?.label ?? null;
