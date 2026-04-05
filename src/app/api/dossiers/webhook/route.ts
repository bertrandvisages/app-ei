import { NextResponse } from "next/server";

async function wpFetch(path: string, options?: RequestInit) {
  const wpUrl = process.env.WORDPRESS_API_URL;
  const wpUser = process.env.WORDPRESS_USERNAME;
  const wpPass = process.env.WORDPRESS_APP_PASSWORD;
  const credentials = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");

  return fetch(`${wpUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
      ...options?.headers,
    },
  });
}

export async function POST(request: Request) {
  let data;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const items = Array.isArray(data) ? data : [data];
  const categoryId = parseInt(process.env.WORDPRESS_DOSSIERS_CATEGORY_ID || "1", 10);
  const results = [];

  for (const item of items) {
    if (!item.title) continue;

    try {
      const res = await wpFetch("/posts", {
        method: "POST",
        body: JSON.stringify({
          title: item.title,
          content: item.content || "",
          status: "draft",
          categories: [categoryId],
        }),
      });

      if (res.ok) {
        const post = await res.json();
        results.push({ id: post.id, title: item.title, status: "created" });
      } else {
        const err = await res.text();
        results.push({ title: item.title, status: "error", error: err });
      }
    } catch (err) {
      results.push({
        title: item.title,
        status: "error",
        error: err instanceof Error ? err.message : "Erreur",
      });
    }
  }

  return NextResponse.json({ inserted: results.filter((r) => r.status === "created").length, results });
}
