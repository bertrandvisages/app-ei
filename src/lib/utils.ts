import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Décode les entités HTML héritées de l'import WordPress (&rsquo;, &hellip;, etc.)
// pour que le titre affiché et édité dans le dashboard soit du texte propre.
// Le site Astro a le même helper côté lecture, on garde la cohérence.
export function decodeEntities(s: string | null | undefined): string {
  if (!s) return ""
  return s
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "« ")
    .replace(/&rdquo;/g, " »")
    .replace(/&laquo;/g, "« ")
    .replace(/&raquo;/g, " »")
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
}
