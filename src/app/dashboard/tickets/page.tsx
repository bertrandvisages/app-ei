"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { toast } from "sonner";

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: "non_traite" | "traite";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null);
  const [filter, setFilter] = useState<"all" | "non_traite" | "traite">("all");

  useEffect(() => {
    fetch("/api/tickets")
      .then((r) => r.json())
      .then((data) => setTickets(Array.isArray(data) ? data : []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newDescription.trim()) {
      toast.error("Titre et description obligatoires");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, description: newDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setTickets((prev) => [data, ...prev]);
      setNewTitle("");
      setNewDescription("");
      setShowForm(false);
      toast.success("Ticket créé et envoyé par email");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
    setCreating(false);
  };

  const startEdit = (t: Ticket) => {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditDescription(t.description);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          title: editTitle,
          description: editDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setTickets((prev) =>
        prev.map((t) =>
          t.id === editingId ? { ...t, title: editTitle, description: editDescription } : t
        )
      );
      setEditingId(null);
      toast.success("Ticket mis à jour");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
    setSavingEdit(false);
  };

  const toggleStatus = async (t: Ticket) => {
    const next = t.status === "traite" ? "non_traite" : "traite";
    const res = await fetch("/api/tickets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, status: next }),
    });
    if (!res.ok) {
      toast.error("Impossible de mettre à jour le statut");
      return;
    }
    setTickets((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, status: next } : x))
    );
    toast.success(next === "traite" ? "Marqué traité" : "Marqué non traité");
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    const res = await fetch(
      `/api/tickets?id=${encodeURIComponent(deleteTarget.id)}`,
      { method: "DELETE" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Suppression échouée");
      return;
    }
    setTickets((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    if (editingId === deleteTarget.id) setEditingId(null);
    toast.success("Ticket supprimé");
  };

  const visibleTickets = tickets.filter((t) => filter === "all" || t.status === filter);
  const openCount = tickets.filter((t) => t.status === "non_traite").length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tickets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Demandes de modification du site, envoyées par email à{" "}
            <span className="font-mono">mac@visages.biz</span>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {openCount > 0 && (
            <Badge className="bg-[#E35205] hover:bg-[#c44604] text-white text-xs">
              {openCount} non traité{openCount > 1 ? "s" : ""}
            </Badge>
          )}
          <Button
            className="bg-[#E35205] hover:bg-[#c44604]"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? "Annuler" : "Nouveau ticket"}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouveau ticket</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Titre</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex : Corriger la coquille dans le hero de la page X"
                maxLength={200}
              />
              <p className="text-[10px] text-muted-foreground text-right">
                {newTitle.length}/200
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Décris précisément ce qu'il faut modifier : page, texte exact, comportement attendu."
                rows={6}
                maxLength={10000}
              />
              <p className="text-[10px] text-muted-foreground text-right">
                {newDescription.length}/10000
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={creating}>
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Envoi…" : "Créer et envoyer"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 text-xs">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          Tous ({tickets.length})
        </Button>
        <Button
          variant={filter === "non_traite" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("non_traite")}
        >
          Non traités ({openCount})
        </Button>
        <Button
          variant={filter === "traite" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("traite")}
        >
          Traités ({tickets.length - openCount})
        </Button>
      </div>

      <div className="rounded-lg border bg-background overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead className="w-32">Statut</TableHead>
              <TableHead className="w-32">Créé</TableHead>
              <TableHead className="text-right w-44">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-12">
                  Chargement…
                </TableCell>
              </TableRow>
            ) : visibleTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-12">
                  Aucun ticket pour l&apos;instant.
                </TableCell>
              </TableRow>
            ) : (
              visibleTickets.map((t) => (
                <>
                  <TableRow key={t.id}>
                    <TableCell>
                      <p className={`text-sm ${t.status === "non_traite" ? "font-semibold" : ""}`}>
                        {t.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                        {t.description}
                      </p>
                    </TableCell>
                    <TableCell>
                      {t.status === "traite" ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]">
                          Traité
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Non traité
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => toggleStatus(t)}
                          title={
                            t.status === "traite" ? "Re-marquer non traité" : "Marquer traité"
                          }
                        >
                          {t.status === "traite" ? "Rouvrir" : "Traité"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => (editingId === t.id ? setEditingId(null) : startEdit(t))}
                        >
                          {editingId === t.id ? "Fermer" : "Éditer"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setDeleteTarget(t)}
                          title="Supprimer ce ticket"
                        >
                          Suppr.
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {editingId === t.id && (
                    <TableRow key={`${t.id}-edit`}>
                      <TableCell colSpan={4} className="bg-muted/30 p-0">
                        <div className="p-6 space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Titre</Label>
                            <Input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              maxLength={200}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Description</Label>
                            <Textarea
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              rows={6}
                              maxLength={10000}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingId(null)}
                              disabled={savingEdit}
                            >
                              Annuler
                            </Button>
                            <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit}>
                              {savingEdit ? "Sauvegarde…" : "Sauvegarder"}
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            L&apos;édition d&apos;un ticket ne renvoie pas d&apos;email — seule
                            la création initiale envoie une notification à mac@visages.biz.
                          </p>
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
        itemLabel={`le ticket « ${deleteTarget?.title ?? ""} »`}
        description="Cette action est irréversible. L'email reçu par mac@visages.biz ne sera pas affecté."
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
