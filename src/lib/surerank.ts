// SureRank uses its own dedicated REST endpoint, not the standard WP post meta API.

interface SureRankSEO {
  seo_title: string;
  seo_description: string;
}

function getCredentials() {
  const wpUser = process.env.WORDPRESS_USERNAME;
  const wpPass = process.env.WORDPRESS_APP_PASSWORD;
  return Buffer.from(`${wpUser}:${wpPass}`).toString("base64");
}

function getSureRankBase() {
  // WORDPRESS_API_URL is e.g. https://lenoncote.fr/wp-json/wp/v2
  // SureRank endpoint is at https://lenoncote.fr/wp-json/surerank/v1
  const wpUrl = process.env.WORDPRESS_API_URL || "";
  return wpUrl.replace(/\/wp\/v2\/?$/, "/surerank/v1");
}

export async function readSureRank(postId: number, postType = "post"): Promise<SureRankSEO> {
  const result = { seo_title: "", seo_description: "" };
  try {
    const res = await fetch(
      `${getSureRankBase()}/post/settings?post_id=${postId}&post_type=${postType}`,
      {
        headers: { Authorization: `Basic ${getCredentials()}` },
      }
    );
    if (!res.ok) return result;
    const data = await res.json();
    const meta = data?.metaData || data?.data?.metaData || data;
    return {
      seo_title: meta?.page_title || "",
      seo_description: meta?.page_description || "",
    };
  } catch {
    return result;
  }
}

export async function writeSureRank(
  postId: number,
  seoTitle: string,
  seoDescription: string
): Promise<boolean> {
  try {
    const res = await fetch(`${getSureRankBase()}/post/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${getCredentials()}`,
      },
      body: JSON.stringify({
        post_id: postId,
        metaData: {
          page_title: seoTitle || "",
          page_description: seoDescription || "",
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
