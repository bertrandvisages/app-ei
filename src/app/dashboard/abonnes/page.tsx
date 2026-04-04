"use client";

import { useEffect, useState } from "react";
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

export default function AbonnesPage() {
  const supabase = createClient();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

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
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Département</TableHead>
              <TableHead>Newsletter</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Inscrit le</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscribers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  Aucun abonné
                </TableCell>
              </TableRow>
            ) : (
              subscribers.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">
                    {sub.first_name || sub.last_name
                      ? `${sub.first_name || ""} ${sub.last_name || ""}`.trim()
                      : sub.login || "-"}
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
