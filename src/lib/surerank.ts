// Serialize SEO data to PHP format for SureRank
export function serializeSureRank(title: string, description: string): string {
  const t = title || "";
  const d = description || "";
  // PHP serialize: count bytes for UTF-8 strings
  const tLen = new TextEncoder().encode(t).length;
  const dLen = new TextEncoder().encode(d).length;
  return `a:2:{s:10:"page_title";s:${tLen}:"${t}";s:16:"page_description";s:${dLen}:"${d}";}`;
}
