"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// ─── Type unifié inscrits + subscribers ──────────────────────
type Row = {
  id: string;             // clé composite "wp-xxx" ou "ins-xxx" pour React
  raw_id: string;         // id natif pour les opérations server
  source: "wp" | "inscription";
  email: string;
  first_name: string | null;
  last_name: string | null;
  user_type: string | null;
  investisseur_type: string | null;
  societe: string | null;
  departement: string | null;
  newsletter: boolean;
  recontacter: boolean;
  cgu: boolean;
  registered_at: string | null;
};

type SortKey =
  | "name"
  | "email"
  | "user_type"
  | "societe"
  | "departement"
  | "newsletter"
  | "recontacter"
  | "source"
  | "registered_at";
type SortDir = "asc" | "desc";

function getName(r: Row) {
  return [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
}

export default function AbonnesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("registered_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Filtres
  const [search, setSearch] = useState("");
  const [filterUserType, setFilterUserType] = useState<string>("");
  const [filterInvestisseur, setFilterInvestisseur] = useState<string>("");
  const [filterNewsletter, setFilterNewsletter] = useState<string>("");
  const [filterRecontacter, setFilterRecontacter] = useState<string>("");
  const [filterSource, setFilterSource] = useState<string>("");

  const fetchRows = useCallback(async () => {
    const supabase = createClient();
    const [{ data: subs }, { data: insc }] = await Promise.all([
      supabase
        .from("subscribers")
        .select(
          "id, email, first_name, last_name, user_type, investisseur_type, societe, departement, newsletter, recontacter, cgu, registered_at, created_at"
        ),
      supabase
        .from("inscrits")
        .select(
          "id, email, first_name, last_name, user_type, investisseur_type, societe, departement, newsletter, recontacter, cgu, created_at"
        ),
    ]);

    const subsRows: Row[] = (subs ?? []).map((s) => ({
      id: `wp-${s.id}`,
      raw_id: s.id,
      source: "wp",
      email: s.email,
      first_name: s.first_name,
      last_name: s.last_name,
      user_type: s.user_type,
      investisseur_type: s.investisseur_type,
      societe: s.societe,
      departement: s.departement,
      newsletter: !!s.newsletter,
      recontacter: !!s.recontacter,
      cgu: !!s.cgu,
      registered_at: s.registered_at ?? s.created_at ?? null,
    }));

    const inscRows: Row[] = (insc ?? []).map((i) => ({
      id: `ins-${i.id}`,
      raw_id: i.id,
      source: "inscription",
      email: i.email,
      first_name: i.first_name,
      last_name: i.last_name,
      user_type: i.user_type,
      investisseur_type: i.investisseur_type,
      societe: i.societe,
      departement: i.departement,
      newsletter: !!i.newsletter,
      recontacter: !!i.recontacter,
      cgu: !!i.cgu,
      registered_at: i.created_at ?? null,
    }));

    setRows([...subsRows, ...inscRows]);
  }, []);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setIsAdmin(profile?.role === "admin");
      }
      await fetchRows();
      setLoading(false);
    }
    load();
  }, [fetchRows]);

  const handleDelete = async (row: Row) => {
    const name = [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email;
    const confirmed = window.confirm(
      `Supprimer définitivement « ${name} » ?\n\nL'abonné sera retiré de la base et, s'il avait un compte, son accès au site sera révoqué.`
    );
    if (!confirmed) return;

    setDeletingId(row.id);
    try {
      const res = await fetch("/api/subscribers/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: row.source, id: row.raw_id }),
      });

      const text = await res.text();
      let data: { error?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: `Réponse serveur invalide (HTTP ${res.status}).` };
      }
      if (!res.ok) {
        throw new Error(data.error || `Erreur HTTP ${res.status}`);
      }

      toast.success("Abonné supprimé");
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la suppression");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const name = getName(r).toLowerCase();
        const email = r.email.toLowerCase();
        const societe = (r.societe || "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !societe.includes(q))
          return false;
      }
      if (filterUserType && r.user_type !== filterUserType) return false;
      if (filterInvestisseur && r.investisseur_type !== filterInvestisseur)
        return false;
      if (filterNewsletter === "yes" && !r.newsletter) return false;
      if (filterNewsletter === "no" && r.newsletter) return false;
      if (filterRecontacter === "yes" && !r.recontacter) return false;
      if (filterRecontacter === "no" && r.recontacter) return false;
      if (filterSource && r.source !== filterSource) return false;
      return true;
    });
  }, [
    rows,
    search,
    filterUserType,
    filterInvestisseur,
    filterNewsletter,
    filterRecontacter,
    filterSource,
  ]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: string | boolean | null;
      let vb: string | boolean | null;

      switch (sortKey) {
        case "name": va = getName(a); vb = getName(b); break;
        case "email": va = a.email; vb = b.email; break;
        case "user_type": va = a.user_type; vb = b.user_type; break;
        case "societe": va = a.societe; vb = b.societe; break;
        case "departement": va = a.departement; vb = b.departement; break;
        case "newsletter": va = a.newsletter; vb = b.newsletter; break;
        case "recontacter": va = a.recontacter; vb = b.recontacter; break;
        case "source": va = a.source; vb = b.source; break;
        case "registered_at": va = a.registered_at; vb = b.registered_at; break;
      }

      if (typeof va === "boolean" && typeof vb === "boolean") {
        return sortDir === "asc"
          ? va === vb ? 0 : va ? -1 : 1
          : va === vb ? 0 : va ? 1 : -1;
      }
      const sa = (va || "").toString().toLowerCase();
      const sb = (vb || "").toString().toLowerCase();
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [filtered, sortKey, sortDir]);

  const resetFilters = () => {
    setSearch("");
    setFilterUserType("");
    setFilterInvestisseur("");
    setFilterNewsletter("");
    setFilterRecontacter("");
    setFilterSource("");
  };

  const hasActiveFilter =
    !!search ||
    !!filterUserType ||
    !!filterInvestisseur ||
    !!filterNewsletter ||
    !!filterRecontacter ||
    !!filterSource;

  // Export CSV des lignes courantes (post-filtres + post-tri, comme affiche).
  // - Separateur point-virgule pour compatibilite Excel FR (qui interprete
  //   la virgule comme decimale)
  // - BOM UTF-8 en tete pour qu'Excel detecte les accents
  // - Booleens en "Oui"/"Non" et date au format FR pour lisibilite directe
  const exportCsv = () => {
    const headers = [
      "Source",
      "Inscrit le",
      "Prénom",
      "Nom",
      "Email",
      "Type",
      "Type investisseur",
      "Société",
      "Département",
      "Newsletter",
      "Recontacter",
      "CGU acceptées",
    ];
    const escape = (v: string | number | boolean | null | undefined): string => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      // RFC 4180 : si contient separateur, guillemet ou saut de ligne → encadrer
      // de guillemets et doubler les guillemets internes.
      if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const yesNo = (b: boolean) => (b ? "Oui" : "Non");
    const fmtDate = (d: string | null) => {
      if (!d) return "";
      try {
        return new Date(d).toLocaleString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        return d;
      }
    };

    const lines = [headers.map(escape).join(";")];
    for (const r of sorted) {
      lines.push(
        [
          r.source === "wp" ? "WordPress" : "Inscription",
          fmtDate(r.registered_at),
          r.first_name ?? "",
          r.last_name ?? "",
          r.email,
          r.user_type ?? "",
          r.investisseur_type ?? "",
          r.societe ?? "",
          r.departement ?? "",
          yesNo(r.newsletter),
          yesNo(r.recontacter),
          yesNo(r.cgu),
        ]
          .map(escape)
          .join(";")
      );
    }

    // ﻿ = BOM UTF-8 pour qu'Excel ouvre en UTF-8 et affiche les accents
    const csv = "﻿" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 10);
    const suffix = hasActiveFilter ? "-filtres" : "";
    a.href = url;
    a.download = `abonnes-${ts}${suffix}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${sorted.length} ligne${sorted.length > 1 ? "s" : ""} exportées`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  const SortArrow = ({ col }: { col: SortKey }) => (
    <svg
      className={`inline-block ml-1 h-3 w-3 transition-transform ${
        sortKey === col ? "text-foreground" : "text-muted-foreground/40"
      } ${sortKey === col && sortDir === "desc" ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
    </svg>
  );

  const selectClass =
    "flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Abonnés</h1>
          <p className="text-muted-foreground">
            {sorted.length} sur {rows.length} inscrits
          </p>
        </div>
        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={sorted.length === 0}
          title={
            hasActiveFilter
              ? "Exporter les abonnés correspondant aux filtres actifs"
              : "Exporter tous les abonnés"
          }
        >
          Exporter CSV
          {hasActiveFilter && (
            <span className="ml-1.5 text-[10px] text-muted-foreground">
              ({sorted.length})
            </span>
          )}
        </Button>
      </div>

      {/* ─── Filtres ─── */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="space-y-1 col-span-1 md:col-span-2">
            <Label className="text-xs">Rechercher</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, email, société…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <select
              value={filterUserType}
              onChange={(e) => setFilterUserType(e.target.value)}
              className={selectClass}
            >
              <option value="">Tous</option>
              <option value="distributeur">Distributeur</option>
              <option value="investisseur">Investisseur</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Profil investisseur</Label>
            <select
              value={filterInvestisseur}
              onChange={(e) => setFilterInvestisseur(e.target.value)}
              className={selectClass}
            >
              <option value="">Tous</option>
              <option value="professionnel">Professionnel</option>
              <option value="averti">Averti</option>
              <option value="non_professionnel">Non professionnel</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Newsletter</Label>
            <select
              value={filterNewsletter}
              onChange={(e) => setFilterNewsletter(e.target.value)}
              className={selectClass}
            >
              <option value="">Tous</option>
              <option value="yes">Oui</option>
              <option value="no">Non</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Contact</Label>
            <select
              value={filterRecontacter}
              onChange={(e) => setFilterRecontacter(e.target.value)}
              className={selectClass}
            >
              <option value="">Tous</option>
              <option value="yes">Oui</option>
              <option value="no">Non</option>
            </select>
          </div>
        </div>
        {hasActiveFilter && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                Nom <SortArrow col="name" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("email")}>
                Email <SortArrow col="email" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("user_type")}>
                Type <SortArrow col="user_type" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("societe")}>
                Société <SortArrow col="societe" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("departement")}>
                Département <SortArrow col="departement" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("newsletter")}>
                Newsletter <SortArrow col="newsletter" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("recontacter")}>
                Contact <SortArrow col="recontacter" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("registered_at")}>
                Inscrit le <SortArrow col="registered_at" />
              </TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-12 text-muted-foreground">
                  Aucun abonné{hasActiveFilter ? " ne correspond aux filtres" : ""}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{getName(r) || "—"}</TableCell>
                  <TableCell className="text-sm">{r.email}</TableCell>
                  <TableCell>
                    {r.user_type && (
                      <Badge variant="outline" className="text-xs">
                        {r.user_type}
                      </Badge>
                    )}
                    {r.investisseur_type && (
                      <Badge variant="secondary" className="text-xs ml-1">
                        {r.investisseur_type}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.societe || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.departement || "—"}
                  </TableCell>
                  <TableCell>
                    {r.newsletter ? (
                      <span className="text-green-600 text-xs font-medium">Oui</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Non</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.recontacter ? (
                      <span className="text-[#E35205] text-xs font-medium">Oui</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Non</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.registered_at
                      ? new Date(r.registered_at).toLocaleDateString("fr-FR")
                      : "—"}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 text-destructive hover:bg-destructive hover:text-white"
                        onClick={() => handleDelete(r)}
                        disabled={deletingId === r.id}
                      >
                        {deletingId === r.id ? "…" : "Supprimer"}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
