export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Spaces to hyphens
    .replace(/-+/g, "-") // Multiple hyphens to single
    .replace(/^-|-$/g, "") // Trim hyphens
    .slice(0, 80); // Max length
}

/** Longueur max d'un slug, alignee sur generateSlug. */
const MAX = 80;

/**
 * Rend un slug unique en le suffixant -2, -3… tant que `taken` repond vrai.
 *
 * Sans ce controle, deux contenus au titre identique recevraient le meme slug,
 * donc la meme URL : le build Astro genere un dossier par slug, le second
 * ecraserait le premier et un des deux articles deviendrait inatteignable.
 *
 * `taken` est fourni par l'appelant parce que la verification depend de la
 * table (contributions ou dossiers) et du client Supabase de la requete.
 */
export async function uniqueSlug(
  base: string,
  taken: (slug: string) => Promise<boolean>
): Promise<string> {
  if (!(await taken(base))) return base;
  for (let n = 2; n <= 50; n++) {
    const suffix = `-${n}`;
    // On tronque la base, pas le suffixe : sinon un titre de 80 caracteres
    // perdrait le numero et on bouclerait sur un slug deja pris.
    const candidate = base.slice(0, MAX - suffix.length) + suffix;
    if (!(await taken(candidate))) return candidate;
  }
  throw new Error(`Aucun slug libre a partir de « ${base} »`);
}
