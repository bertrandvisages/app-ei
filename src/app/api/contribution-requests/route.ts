import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Demandes de contribution.
//
// - POST  : public (depuis /devenir-contributeur du site). Multipart form,
//   anti-spam honeypot + time-check, uploads vers Supabase Storage,
//   INSERT en DB, email a contact@lenoncote.fr. CORS pour lenoncote.fr.
// - GET   : dashboard, authentifie. Liste / by-id / count unread.
// - PUT   : toggle status lu/non_lu.
// - DELETE : suppression.

const ALLOWED_ORIGINS = [
  "https://lenoncote.fr",
  "https://www.lenoncote.fr",
  "https://preview.lenoncote.fr",
  "http://localhost:4321",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

// ─── Helpers ─────────────────────────────────────────────────────

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB par fichier
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.oasis.opendocument.text", // .odt
  "application/rtf",
  "text/plain",
]);

function safeFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";
  const safe = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${safe || "file"}${ext}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

type Attachment = {
  name: string;
  url: string;
  content_type: string;
  size_bytes: number;
};

// ─── POST : public, depuis le site ───────────────────────────────

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Form invalide" },
      { status: 400, headers: cors }
    );
  }

  const first_name = String(form.get("first_name") || "").trim();
  const last_name = String(form.get("last_name") || "").trim();
  const email = String(form.get("email") || "").trim();
  const linkedin = String(form.get("linkedin") || "").trim();
  const websiteField = String(form.get("user_website") || "").trim();
  const role = String(form.get("role") || "").trim();
  const company = String(form.get("company") || "").trim();
  const message = String(form.get("message") || "").trim();
  const contribution = String(form.get("contribution") || "").trim();
  const honeypot = String(form.get("hp_website") || "");
  const tStr = String(form.get("t") || "0");
  const tNum = Number(tStr);

  // 1) Anti-spam : honeypot + time-check (3s mini)
  if (honeypot.trim() !== "") {
    console.warn("[contribution-requests] Honeypot rempli :", honeypot);
    return NextResponse.json({ success: true }, { headers: cors });
  }
  if (!tNum || Date.now() - tNum < 3000) {
    console.warn("[contribution-requests] Time-check echoue");
    return NextResponse.json({ success: true }, { headers: cors });
  }

  // 2) Validation champs obligatoires
  if (!first_name || !last_name || !email || !contribution) {
    return NextResponse.json(
      { error: "Prénom, nom, email et contribution sont obligatoires." },
      { status: 400, headers: cors }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Email invalide." },
      { status: 400, headers: cors }
    );
  }
  if (contribution.length > 30000) {
    return NextResponse.json(
      { error: "Contribution trop longue (30000 caractères max)." },
      { status: 400, headers: cors }
    );
  }

  // 3) Fichiers — on filtre les entrees vides (browser injecte parfois un
  // File de size 0 quand input multiple est vide).
  const rawFiles = form.getAll("files");
  const files: File[] = rawFiles
    .filter((f): f is File => f instanceof File)
    .filter((f) => f.size > 0);

  console.log(
    `[contribution-requests] Reception : ${first_name} ${last_name} <${email}>, ${files.length} fichier(s)`
  );
  for (const f of files) {
    console.log(`  - ${f.name} (${f.type || "no-mime"}, ${f.size} bytes)`);
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `${MAX_FILES} fichiers maximum.` },
      { status: 400, headers: cors }
    );
  }

  // Validation MIME + taille. Si MIME inconnu/vide, on accepte tant que
  // l'extension est dans une whitelist (sauve les cas Windows ou navigateurs
  // qui n'envoient pas le bon Content-Type).
  const ALLOWED_EXT = /\.(png|jpe?g|webp|avif|heic|heif|gif|pdf|docx?|odt|rtf|txt)$/i;
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          error: `Fichier « ${f.name} » trop lourd (${(f.size / 1024 / 1024).toFixed(1)} MB). Limite : 10 MB par fichier.`,
        },
        { status: 400, headers: cors }
      );
    }
    const mimeOk = f.type && ALLOWED_MIME.has(f.type);
    const extOk = ALLOWED_EXT.test(f.name);
    if (!mimeOk && !extOk) {
      return NextResponse.json(
        {
          error: `Type de fichier non autorisé pour « ${f.name} » (${f.type || "type inconnu"}). Acceptés : images, PDF, Word, ODT, RTF, TXT.`,
        },
        { status: 400, headers: cors }
      );
    }
  }

  // 4) Upload des fichiers dans Supabase Storage via service_role
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const attachments: Attachment[] = [];
  const uploadWarnings: string[] = [];

  if (files.length > 0) {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error(
        "[contribution-requests] SUPABASE_URL/SERVICE_ROLE_KEY manquant cote env — fichiers IGNORES"
      );
      uploadWarnings.push(
        "Configuration serveur incomplète : pièces jointes non sauvegardées."
      );
    } else {
      try {
        const admin = createAdminClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
          auth: { persistSession: false },
        });
        const ts = Date.now();
        const folder = `contributions_requests/${ts}`;
        for (const f of files) {
          const buf = Buffer.from(await f.arrayBuffer());
          const path = `${folder}/${safeFilename(f.name)}`;
          const contentType = f.type || "application/octet-stream";
          const { error: upErr } = await admin.storage
            .from("media")
            .upload(path, buf, {
              contentType,
              upsert: false,
            });
          if (upErr) {
            console.error(
              `[contribution-requests] Upload Storage echoue (${path}) :`,
              upErr.message
            );
            uploadWarnings.push(
              `Fichier « ${f.name} » non sauvegardé : ${upErr.message}`
            );
            continue;
          }
          const { data: pub } = admin.storage.from("media").getPublicUrl(path);
          attachments.push({
            name: f.name,
            url: pub.publicUrl,
            content_type: contentType,
            size_bytes: f.size,
          });
          console.log(
            `[contribution-requests] Upload OK : ${path} (${pub.publicUrl})`
          );
        }
      } catch (err) {
        console.error("[contribution-requests] Exception upload :", err);
        uploadWarnings.push(
          `Erreur lors de l'enregistrement des pièces jointes : ${
            err instanceof Error ? err.message : "inconnue"
          }`
        );
      }
    }
  }

  // 5) INSERT en DB (best-effort, ne bloque pas l'envoi email)
  if (SUPABASE_URL && SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });
      const { error: dbErr } = await admin.from("contribution_requests").insert({
        first_name,
        last_name,
        email,
        linkedin: linkedin || null,
        website: websiteField || null,
        role: role || null,
        company: company || null,
        message: message || null,
        contribution,
        attachments,
      });
      if (dbErr) {
        console.warn(
          "[contribution-requests] INSERT echoue :",
          dbErr.message
        );
      }
    } catch (err) {
      console.warn("[contribution-requests] Exception INSERT :", err);
    }
  }

  // 6) Envoi email a contact@
  await sendNotificationEmail({
    first_name,
    last_name,
    email,
    linkedin,
    website: websiteField,
    role,
    company,
    message,
    contribution,
    attachments,
  });

  return NextResponse.json(
    { success: true, attachments_saved: attachments.length, warnings: uploadWarnings },
    { headers: cors }
  );
}

async function sendNotificationEmail(payload: {
  first_name: string;
  last_name: string;
  email: string;
  linkedin: string;
  website: string;
  role: string;
  company: string;
  message: string;
  contribution: string;
  attachments: Attachment[];
}) {
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const RECIPIENT =
    process.env.CONTRIBUTION_RECIPIENT ||
    process.env.CONTACT_RECIPIENT ||
    "contact@lenoncote.fr";

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("[contribution-requests] SMTP non configure, pas d'email");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const subject = `[Devenir contributeur] ${payload.first_name} ${payload.last_name}`;

  const linesText: string[] = [
    `De : ${payload.first_name} ${payload.last_name} <${payload.email}>`,
  ];
  if (payload.role || payload.company) {
    linesText.push(
      `Poste / société : ${[payload.role, payload.company].filter(Boolean).join(" — ")}`
    );
  }
  if (payload.linkedin) linesText.push(`LinkedIn : ${payload.linkedin}`);
  if (payload.website) linesText.push(`Site web : ${payload.website}`);
  if (payload.message) {
    linesText.push("", "──── Message ────", payload.message);
  }
  linesText.push(
    "",
    "──── Contribution proposée ────",
    payload.contribution
  );
  if (payload.attachments.length > 0) {
    linesText.push("", "──── Pièces jointes ────");
    for (const a of payload.attachments) {
      linesText.push(`- ${a.name} : ${a.url}`);
    }
  }
  linesText.push("", "──── Voir / gérer ────", "https://dash.lenoncote.fr/dashboard/demandes");

  const attachmentsHtml = payload.attachments
    .map(
      (a) =>
        `<li><a href="${escapeHtml(a.url)}">${escapeHtml(a.name)}</a> <span style="color:#666;">(${(a.size_bytes / 1024).toFixed(0)} KB)</span></li>`
    )
    .join("");

  const html = `
<div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #101820;">
  <h2 style="margin:0 0 12px;font-size:18px;">Nouvelle demande de contribution</h2>
  <p style="margin:0 0 6px;font-size:14px;">
    <strong>${escapeHtml(payload.first_name)} ${escapeHtml(payload.last_name)}</strong>
    &nbsp;—&nbsp;<a href="mailto:${escapeHtml(payload.email)}">${escapeHtml(payload.email)}</a>
  </p>
  ${payload.role || payload.company ? `<p style="margin:0 0 6px;font-size:13px;color:#444;">${escapeHtml([payload.role, payload.company].filter(Boolean).join(" — "))}</p>` : ""}
  ${payload.linkedin ? `<p style="margin:0 0 6px;font-size:13px;"><strong>LinkedIn :</strong> <a href="${escapeHtml(payload.linkedin)}">${escapeHtml(payload.linkedin)}</a></p>` : ""}
  ${payload.website ? `<p style="margin:0 0 6px;font-size:13px;"><strong>Site web :</strong> <a href="${escapeHtml(payload.website)}">${escapeHtml(payload.website)}</a></p>` : ""}
  <hr style="border:none;border-top:1px solid #ccc;margin:16px 0;" />
  ${payload.message ? `<p style="font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 6px;">Message</p><p style="white-space:pre-wrap;font-size:14px;">${escapeHtml(payload.message)}</p><hr style="border:none;border-top:1px solid #ccc;margin:16px 0;" />` : ""}
  <p style="font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 6px;">Contribution proposée</p>
  <p style="white-space:pre-wrap;font-size:14px;">${escapeHtml(payload.contribution)}</p>
  ${
    payload.attachments.length > 0
      ? `<hr style="border:none;border-top:1px solid #ccc;margin:16px 0;" /><p style="font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 6px;">Pièces jointes</p><ul style="font-size:13px;">${attachmentsHtml}</ul>`
      : ""
  }
  <hr style="border:none;border-top:1px solid #ccc;margin:16px 0;" />
  <p style="font-size:12px;color:#666;">
    <a href="https://dash.lenoncote.fr/dashboard/demandes">Voir / gérer dans le dashboard</a>
  </p>
</div>`.trim();

  try {
    await transporter.sendMail({
      from: `"Devenir contributeur" <${SMTP_USER}>`,
      to: RECIPIENT,
      replyTo: `"${payload.first_name} ${payload.last_name}" <${payload.email}>`,
      subject,
      text: linesText.join("\n"),
      html,
    });
  } catch (err) {
    console.warn("[contribution-requests] sendMail echoue :", err);
  }
}

// ─── GET : dashboard ─────────────────────────────────────────────

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      supabase: null,
      err: NextResponse.json({ error: "Non authentifié" }, { status: 401 }),
    };
  }
  return { supabase, err: null };
}

export async function GET(request: Request) {
  const { supabase, err } = await requireAuth();
  if (err) return err;
  if (!supabase) return NextResponse.json({ error: "Erreur" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const count = searchParams.get("count");

  if (count === "unread") {
    const { count: n, error } = await supabase
      .from("contribution_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "non_lu");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ unread: n ?? 0 });
  }

  if (id) {
    const { data, error } = await supabase
      .from("contribution_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data)
      return NextResponse.json({ error: "Introuvable" }, { status: 404 });

    if ((data as { status: string }).status === "non_lu") {
      await supabase
        .from("contribution_requests")
        .update({ status: "lu" })
        .eq("id", id);
      (data as { status: string }).status = "lu";
    }
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from("contribution_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const { supabase, err } = await requireAuth();
  if (err) return err;
  if (!supabase) return NextResponse.json({ error: "Erreur" }, { status: 500 });

  const body = await request.json().catch(() => null);
  if (!body?.id || (body.status !== "lu" && body.status !== "non_lu")) {
    return NextResponse.json(
      { error: "Body invalide (id + status lu|non_lu requis)" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("contribution_requests")
    .update({ status: body.status })
    .eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { supabase, err } = await requireAuth();
  if (err) return err;
  if (!supabase) return NextResponse.json({ error: "Erreur" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const { error } = await supabase
    .from("contribution_requests")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
