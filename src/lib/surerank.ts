// Serialize SEO data to PHP format for SureRank
export function serializeSureRank(title: string, description: string): string {
  const t = title || "";
  const d = description || "";
  const tLen = new TextEncoder().encode(t).length;
  const dLen = new TextEncoder().encode(d).length;
  return `a:2:{s:10:"page_title";s:${tLen}:"${t}";s:16:"page_description";s:${dLen}:"${d}";}`;
}

// Deserialize PHP serialized SureRank data
export function deserializeSureRank(serialized: string): { seo_title: string; seo_description: string } {
  const result = { seo_title: "", seo_description: "" };
  if (!serialized) return result;

  const titleMatch = serialized.match(/"page_title";s:\d+:"([\s\S]*?)";s:/);
  if (titleMatch) result.seo_title = titleMatch[1];

  const descMatch = serialized.match(/"page_description";s:\d+:"([\s\S]*?)";}/);
  if (descMatch) result.seo_description = descMatch[1];

  return result;
}
