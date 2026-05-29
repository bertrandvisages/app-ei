"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { toast } from "sonner";

interface Attachment {
  name: string;
  url: string;
  content_type: string;
  size_bytes: number;
}

interface ContributionRequest {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  linkedin: string | null;
  website: string | null;
  role: string | null;
  company: string | null;
  message: string | null;
  contribution: string;
  attachments: Attachment[];
  status: "lu" | "non_lu";
  created_at: string;
  updated_at: string;
}

export default function DemandesPage() {
  const [items, setItems] = useState<ContributionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContributionRequest | null>(
    null
  );

  useEffect(() => {
    fetch("/api/contribution-requests")
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleOpen = async (m: ContributionRequest) => {
    if (openId === m.id) {
      setOpenId(null);
      return;
    }
    setOpenId(m.id);
    if (m.status === "non_lu") {
      try {
        await fetch(
          `/api/contribution-requests?id=${encodeURIComponent(m.id)}`
        );
        setItems((prev) =>
          prev.map((x) => (x.id === m.id ? { ...x, status: "lu" } : x))
        );
      } catch {
        // silencieux
      }
    }
  };

  const toggleRead = async (m: ContributionRequest) => {
    const next = m.status === "lu" ? "non_lu" : "lu";
    const res = await fetch("/api/contribution-requests", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, status: next }),
    });
    if (!res.ok) {
      toast.error("Impossible de mettre à jour le statut");
      return;
    }
    setItems((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, status: next } : x))
    );
    toast.success(next === "lu" ? "Marqué lu" : "Marqué non lu");
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    const res = await fetch(
      `/api/contribution-requests?id=${encodeURIComponent(deleteTarget.id)}`,
      { method: "DELETE" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Suppression échouée");
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    if (openId === deleteTarget.id) setOpenId(null);
    toast.success("Demande supprimée");
  };

  const unreadCount = items.filter((m) => m.status === "non_lu").length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Demandes de contribution</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Soumises via le formulaire{" "}
            <span className="font-mono">/devenir-contributeur</span> du site.
          </p>
        </div>
        {unreadCount > 0 && (
          <Badge className="bg-[#E35205] hover:bg-[#c44604] text-white text-xs">
            {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="rounded-lg border bg-background overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Candidat</TableHead>
              <TableHead>Pitch / contribution</TableHead>
              <TableHead className="w-16 text-center">PJ</TableHead>
              <TableHead className="w-32">Reçu</TableHead>
              <TableHead className="text-right w-40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-12">
                  Chargement…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-12">
                  Aucune demande pour l&apos;instant.
                </TableCell>
              </TableRow>
            ) : (
              items.map((m) => (
                <>
                  <TableRow
                    key={m.id}
                    className={`cursor-pointer ${m.status === "non_lu" ? "bg-orange-50/40" : ""}`}
                    onClick={() => toggleOpen(m)}
                  >
                    <TableCell>
                      {m.status === "non_lu" && (
                        <span className="inline-block w-2 h-2 rounded-full bg-[#E35205]" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className={m.status === "non_lu" ? "font-semibold" : ""}>
                        {m.first_name} {m.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                      {(m.role || m.company) && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {[m.role, m.company].filter(Boolean).join(" — ")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-md">
                      <p className="line-clamp-2">{m.message || m.contribution}</p>
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {m.attachments?.length || 0}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString("fr-FR")}
                      <br />
                      <span className="opacity-60">
                        {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => toggleRead(m)}
                          title={m.status === "lu" ? "Marquer non lu" : "Marquer lu"}
                        >
                          {m.status === "lu" ? "Non lu" : "Lu"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setDeleteTarget(m)}
                          title="Supprimer cette demande"
                        >
                          Suppr.
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {openId === m.id && (
                    <TableRow key={`${m.id}-detail`}>
                      <TableCell colSpan={6} className="bg-muted/30 p-0">
                        <div className="p-6 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                                Candidat
                              </p>
                              <p className="font-medium">
                                {m.first_name} {m.last_name}
                              </p>
                              <a
                                href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: votre demande de contribution`)}`}
                                className="text-[#E35205] hover:underline text-xs"
                              >
                                {m.email}
                              </a>
                            </div>
                            <div>
                              {(m.role || m.company) && (
                                <>
                                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                                    Poste / société
                                  </p>
                                  <p className="text-sm">
                                    {[m.role, m.company].filter(Boolean).join(" — ")}
                                  </p>
                                </>
                              )}
                              <div className="flex gap-3 mt-2 text-xs">
                                {m.linkedin && (
                                  <a
                                    href={m.linkedin}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#E35205] hover:underline"
                                  >
                                    LinkedIn ↗
                                  </a>
                                )}
                                {m.website && (
                                  <a
                                    href={m.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#E35205] hover:underline"
                                  >
                                    Site web ↗
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>

                          {m.message && (
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                                Message
                              </p>
                              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                {m.message}
                              </p>
                            </div>
                          )}

                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                              Contribution proposée
                            </p>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                              {m.contribution}
                            </p>
                          </div>

                          {m.attachments && m.attachments.length > 0 && (
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                                Pièces jointes ({m.attachments.length})
                              </p>
                              <ul className="space-y-1.5">
                                {m.attachments.map((a, i) => (
                                  <li key={i} className="flex items-center gap-2 text-sm">
                                    <a
                                      href={`/api/contribution-requests/attachment?id=${encodeURIComponent(m.id)}&index=${i}`}
                                      className="text-[#E35205] hover:underline"
                                    >
                                      ⬇ {a.name}
                                    </a>
                                    <a
                                      href={a.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                                      title="Ouvrir dans un nouvel onglet"
                                    >
                                      (aperçu)
                                    </a>
                                    <span className="text-xs text-muted-foreground">
                                      · {(a.size_bytes / 1024).toFixed(0)} KB
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="pt-2 flex gap-2">
                            <a
                              href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: votre demande de contribution`)}`}
                              className="inline-flex items-center px-4 py-2 bg-[#E35205] hover:bg-[#c44604] text-white text-xs font-medium rounded-md transition-colors"
                            >
                              Répondre par email
                            </a>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemLabel={`la demande de « ${deleteTarget?.first_name ?? ""} ${deleteTarget?.last_name ?? ""} »`}
        description="Cette action est irréversible. L'email reçu et les fichiers stockés ne sont pas affectés par cette suppression."
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
