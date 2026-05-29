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

interface Message {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  message: string;
  status: "lu" | "non_lu";
  created_at: string;
  updated_at: string;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);

  useEffect(() => {
    fetch("/api/messages")
      .then((r) => r.json())
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleOpen = async (m: Message) => {
    if (openId === m.id) {
      setOpenId(null);
      return;
    }
    setOpenId(m.id);
    // Si le message etait non lu, GET ?id=... le bascule en 'lu' cote serveur.
    // On met aussi l'etat local a jour pour MAJ instantanee du badge.
    if (m.status === "non_lu") {
      try {
        await fetch(`/api/messages?id=${encodeURIComponent(m.id)}`);
        setMessages((prev) =>
          prev.map((x) => (x.id === m.id ? { ...x, status: "lu" } : x))
        );
      } catch {
        // silencieux
      }
    }
  };

  const toggleRead = async (m: Message) => {
    const next = m.status === "lu" ? "non_lu" : "lu";
    const res = await fetch("/api/messages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, status: next }),
    });
    if (!res.ok) {
      toast.error("Impossible de mettre à jour le statut");
      return;
    }
    setMessages((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, status: next } : x))
    );
    toast.success(next === "lu" ? "Marqué comme lu" : "Marqué comme non lu");
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    const res = await fetch(
      `/api/messages?id=${encodeURIComponent(deleteTarget.id)}`,
      { method: "DELETE" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Suppression échouée");
      return;
    }
    setMessages((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    if (openId === deleteTarget.id) setOpenId(null);
    toast.success("Message supprimé");
  };

  const unreadCount = messages.filter((m) => m.status === "non_lu").length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Messages reçus via le formulaire{" "}
            <span className="font-mono">/nous-contacter</span>.
          </p>
        </div>
        {unreadCount > 0 && (
          <Badge className="bg-[#E35205] hover:bg-[#c44604] text-white text-xs">
            {unreadCount} non lu{unreadCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="rounded-lg border bg-background overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Expéditeur</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="w-32">Reçu</TableHead>
              <TableHead className="text-right w-40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-12">
                  Chargement…
                </TableCell>
              </TableRow>
            ) : messages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-12">
                  Aucun message pour l&apos;instant.
                </TableCell>
              </TableRow>
            ) : (
              messages.map((m) => (
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
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-md">
                      <p className="line-clamp-1">{m.message}</p>
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
                          title={m.status === "lu" ? "Marquer comme non lu" : "Marquer comme lu"}
                        >
                          {m.status === "lu" ? "Non lu" : "Lu"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setDeleteTarget(m)}
                          title="Supprimer ce message"
                        >
                          Suppr.
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {openId === m.id && (
                    <TableRow key={`${m.id}-detail`}>
                      <TableCell colSpan={5} className="bg-muted/30 p-0">
                        <div className="p-6 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                                Expéditeur
                              </p>
                              <p className="font-medium">
                                {m.first_name} {m.last_name}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                                Email
                              </p>
                              <a
                                href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: votre message du ${new Date(m.created_at).toLocaleDateString("fr-FR")}`)}`}
                                className="font-medium text-[#E35205] hover:underline"
                              >
                                {m.email}
                              </a>
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                              Message
                            </p>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                              {m.message}
                            </p>
                          </div>
                          <div className="pt-2 flex gap-2">
                            <a
                              href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: votre message du ${new Date(m.created_at).toLocaleDateString("fr-FR")}`)}&body=${encodeURIComponent(`\n\n\n---\nVotre message du ${new Date(m.created_at).toLocaleDateString("fr-FR")} :\n${m.message}`)}`}
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
        itemLabel={`le message de « ${deleteTarget?.first_name ?? ""} ${deleteTarget?.last_name ?? ""} »`}
        description="Cette action est irréversible. L'email reçu dans contact@lenoncote.fr ne sera pas affecté."
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
