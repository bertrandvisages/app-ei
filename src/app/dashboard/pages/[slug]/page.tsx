"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  getPageSchema,
  type PageSchema,
  getDotted,
  setDotted,
} from "@/lib/page-schemas";

type PageRow = {
  slug: string;
  content: Record<string, unknown>;
  seo_title: string | null;
  seo_description: string | null;
};

export default function PageEditor() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  const router = useRouter();

  const schema: PageSchema | null = useMemo(() => getPageSchema(slug), [slug]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  useEffect(() => {
    if (!schema) return;
    fetch(`/api/pages?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data: PageRow) => {
        setContent((data.content as Record<string, unknown>) ?? {});
        setSeoTitle(data.seo_title ?? "");
        setSeoDescription(data.seo_description ?? "");
      })
      .catch(() => {
        // Coquille vide — l'utilisateur saisira et on créera la row au save
        setContent({});
      })
      .finally(() => setLoading(false));
  }, [slug, schema]);

  if (!schema) {
    return (
      <div className="space-y-4 max-w-2xl">
        <p>Page inconnue : {slug}</p>
        <Link
          href="/dashboard/pages"
          className={buttonVariants({ variant: "outline" })}
        >
          ← Retour
        </Link>
      </div>
    );
  }

  // Groupe les fields par leur clé `group` pour rendre des sections visuelles.
  const groups: { name: string; fields: typeof schema.fields }[] = [];
  for (const f of schema.fields) {
    const existing = groups.find((g) => g.name === f.group);
    if (existing) existing.fields.push(f);
    else groups.push({ name: f.group, fields: [f] });
  }

  const handleFieldChange = (key: string, value: string) => {
    setContent((prev) => setDotted(prev, key, value));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          content,
          seo_title: seoTitle,
          seo_description: seoDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success("Page sauvegardée — rebuild déclenché");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/pages"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Pages
          </Link>
          <h1 className="text-2xl font-bold mt-2">{schema.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{schema.description}</p>
          <p className="text-xs text-muted-foreground mt-2">
            URL : <span className="font-mono">{schema.url}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`https://lenoncote.fr${schema.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            Voir la page
          </a>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Sauvegarde…" : "Sauvegarder et publier"}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <>
          {groups.map((group) => (
            <Card key={group.name}>
              <CardHeader>
                <CardTitle className="text-base">{group.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.fields.map((field) => {
                  const value = getDotted(content, field.key);
                  return (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-xs font-medium">
                        {field.label}
                      </Label>
                      {field.type === "textarea" ? (
                        <Textarea
                          value={value}
                          placeholder={field.placeholder}
                          onChange={(e) =>
                            handleFieldChange(field.key, e.target.value)
                          }
                          rows={4}
                        />
                      ) : (
                        <Input
                          value={value}
                          placeholder={field.placeholder}
                          onChange={(e) =>
                            handleFieldChange(field.key, e.target.value)
                          }
                        />
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        Vide → fallback sur la valeur d&apos;origine du site.
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Titre SEO</Label>
                <Input
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="Titre de 60 caractères max"
                  maxLength={60}
                />
                <p className="text-[10px] text-muted-foreground text-right">
                  {seoTitle.length}/60
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Meta description</Label>
                <Input
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="Description de 160 caractères max"
                  maxLength={160}
                />
                <p className="text-[10px] text-muted-foreground text-right">
                  {seoDescription.length}/160
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2 pt-2">
            <Link
              href="/dashboard/pages"
              className={buttonVariants({ variant: "outline" })}
            >
              Annuler
            </Link>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Sauvegarde…" : "Sauvegarder et publier"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
