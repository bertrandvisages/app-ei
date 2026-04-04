"use client";

import { useEffect, useState, useMemo } from "react";
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
import type { Subscriber } from "@/lib/types";

type SortKey = "name" | "email" | "user_type" | "departement" | "newsletter" | "recontacter" | "registered_at";
type SortDir = "asc" | "desc";

function getName(sub: Subscriber) {
  return sub.first_name || sub.last_name
    ? `${sub.first_name || ""} ${sub.last_name || ""}`.trim()
    : sub.login || "";
}

export default function AbonnesPage() {
  const supabase = createClient();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("registered_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("subscribers")
        .select("*")
        .order("created_at", { ascending: false });

      setSubscribers((data as Subscriber[]) || []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    return [...subscribers].sort((a, b) => {
      let va: string | boolean | null;
      let vb: string | boolean | null;

      switch (sortKey) {
        case "name": va = getName(a); vb = getName(b); break;
        case "email": va = a.email; vb = b.email; break;
        case "user_type": va = a.user_type; vb = b.user_type; break;
        case "departement": va = a.departement; vb = b.departement; break;
        case "newsletter": va = a.newsletter; vb = b.newsletter; break;
        case "recontacter": va = a.recontacter; vb = b.recontacter; break;
        case "registered_at": va = a.registered_at; vb = b.registered_at; break;
      }

      if (typeof va === "boolean" && typeof vb === "boolean") {
        return sortDir === "asc" ? (va === vb ? 0 : va ? -1 : 1) : (va === vb ? 0 : va ? 1 : -1);
      }

      const sa = (va || "").toString().toLowerCase();
      const sb = (vb || "").toString().toLowerCase();
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [subscribers, sortKey, sortDir]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  const SortArrow = ({ col }: { col: SortKey }) => (
    <svg
      className={`inline-block ml-1 h-3 w-3 transition-transform ${sortKey === col ? "text-foreground" : "text-muted-foreground/40"} ${sortKey === col && sortDir === "desc" ? "rotate-180" : ""}`}
      fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
    </svg>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Abonnés</h1>
          <p className="text-muted-foreground">
            {subscribers.length} abonné{subscribers.length > 1 ? "s" : ""} inscrits sur lenoncote.fr
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  Aucun abonné
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">
                    {getName(sub) || "-"}
                    {sub.societe && (
                      <p className="text-xs text-muted-foreground">{sub.societe}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{sub.email}</TableCell>
                  <TableCell>
                    {sub.user_type && (
                      <Badge variant="outline" className="text-xs">
                        {sub.user_type}
                      </Badge>
                    )}
                    {sub.investisseur_type && (
                      <Badge variant="secondary" className="text-xs ml-1">
                        {sub.investisseur_type}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {sub.departement || "-"}
                  </TableCell>
                  <TableCell>
                    {sub.newsletter ? (
                      <span className="text-green-600 text-xs font-medium">Oui</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Non</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {sub.recontacter ? (
                      <span className="text-[#E35205] text-xs font-medium">Oui</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Non</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {sub.registered_at
                      ? new Date(sub.registered_at).toLocaleDateString("fr-FR")
                      : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
