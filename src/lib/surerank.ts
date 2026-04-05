// Serialize SEO data to PHP format for SureRank
export function serializeSureRank(title: string, description: string): string {
  const t = title || "";
  const d = description || "";
  return `a:2:{s:10:"page_title";s:${t.length}:"${t}";s:16:"page_description";s:${d.length}:"${d}";}`;
}
