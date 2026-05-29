import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";

// Tickets de demande de modification du site, crees depuis le dashboard
// par les editeurs et notifies par email au dev (mac@visages.biz par
// defaut, override via env TICKET_RECIPIENT).
//
// GET   /api/tickets                  → liste tous tickets
// GET   /api/tickets?count=open       → { open: N } pour le badge sidebar
// GET   /api/tickets?id=...           → un ticket
// POST  /api/tickets                  → cree + envoie email
// PUT   /api/tickets                  → { id, title?, description?, status? }
// DELETE /api/tickets?id=...

type TicketRow = {
  id: string;
  title: string;
  description: string;
  status: "non_traite" | "traite";
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

async function getAuthedSupabase() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, user: null };
  return { supabase, user };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function notifyByEmail(opts: {
  ticket: { id: string; title: string; description: string };
  authorName: string;
  authorEmail: string;
}): Promise<void> {
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const RECIPIENT = process.env.TICKET_RECIPIENT || "mac@visages.biz";

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("[tickets] SMTP non configure, ticket cree sans email");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const subject = `[Ticket] ${opts.ticket.title}`;
  const text = [
    `Nouveau ticket : ${opts.ticket.title}`,
    "",
    `De : ${opts.authorName} <${opts.authorEmail}>`,
    "",
    "──────────────",
    opts.ticket.description,
    "──────────────",
    "",
    `Voir / modifier : https://dash.lenoncote.fr/dashboard/tickets`,
  ].join("\n");

  const html = `
<div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #101820;">
  <h2 style="margin:0 0 12px;font-size:18px;">Nouveau ticket</h2>
  <p style="margin:0 0 6px;font-size:16px;"><strong>${escapeHtml(opts.ticket.title)}</strong></p>
  <p style="margin:0 0 16px;font-size:13px;color:#666;">
    De : ${escapeHtml(opts.authorName)} &lt;<a href="mailto:${escapeHtml(opts.authorEmail)}">${escapeHtml(opts.authorEmail)}</a>&gt;
  </p>
  <hr style="border:none;border-top:1px solid #ccc;margin:16px 0;" />
  <p style="white-space:pre-wrap;font-size:14px;">${escapeHtml(opts.ticket.description)}</p>
  <hr style="border:none;border-top:1px solid #ccc;margin:16px 0;" />
  <p style="font-size:12px;color:#666;">
    <a href="https://dash.lenoncote.fr/dashboard/tickets">Voir / modifier dans le dashboard</a>
  </p>
</div>`.trim();

  try {
    await transporter.sendMail({
      from: `"Tickets Le Non Coté" <${SMTP_USER}>`,
      to: RECIPIENT,
      replyTo: `"${opts.authorName}" <${opts.authorEmail}>`,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.warn("[tickets] Envoi email echoue :", err);
  }
}

export async function GET(request: Request) {
  const { supabase } = await getAuthedSupabase();
  if (!supabase) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const count = searchParams.get("count");

  if (count === "open") {
    const { count: n, error } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("status", "non_traite");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ open: n ?? 0 });
  }

  if (id) {
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthedSupabase();
  if (!supabase || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const title = String(body?.title || "").trim();
  const description = String(body?.description || "").trim();
  if (!title || !description) {
    return NextResponse.json(
      { error: "Titre et description obligatoires." },
      { status: 400 }
    );
  }
  if (title.length > 200) {
    return NextResponse.json(
      { error: "Titre trop long (200 caractères max)." },
      { status: 400 }
    );
  }
  if (description.length > 10000) {
    return NextResponse.json(
      { error: "Description trop longue (10000 caractères max)." },
      { status: 400 }
    );
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("tickets")
    .insert({ title, description, created_by: user.id })
    .select("*")
    .single();
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Recup' du profil pour nom/email dans le mail. Best-effort.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  await notifyByEmail({
    ticket: inserted as TicketRow,
    authorName: profile?.full_name || profile?.email || "Éditeur",
    authorEmail: profile?.email || user.email || "noreply@lenoncote.fr",
  });

  return NextResponse.json(inserted);
}

export async function PUT(request: Request) {
  const { supabase } = await getAuthedSupabase();
  if (!supabase) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: "Titre vide" }, { status: 400 });
    if (t.length > 200) return NextResponse.json({ error: "Titre trop long" }, { status: 400 });
    payload.title = t;
  }
  if (typeof body.description === "string") {
    const d = body.description.trim();
    if (!d) return NextResponse.json({ error: "Description vide" }, { status: 400 });
    if (d.length > 10000)
      return NextResponse.json({ error: "Description trop longue" }, { status: 400 });
    payload.description = d;
  }
  if (body.status === "traite" || body.status === "non_traite") {
    payload.status = body.status;
  }
  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from("tickets")
    .update(payload)
    .eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { supabase } = await getAuthedSupabase();
  if (!supabase) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const { error } = await supabase
    .from("tickets")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
