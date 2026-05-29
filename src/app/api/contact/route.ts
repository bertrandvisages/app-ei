import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Endpoint POST appele depuis le formulaire /nous-contacter du site Astro.
// Envoie un email a contact@lenoncote.fr via SMTP Hostinger.
//
// Body attendu : { first_name, last_name, email, message, website, t }
//   - website : honeypot (doit rester vide)
//   - t       : timestamp d'affichage du form (anti-bot, on exige > 3s de delai)
//
// Env vars requis cote runtime Coolify :
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CONTACT_RECIPIENT (optionnel,
//   default contact@lenoncote.fr)

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin);

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body invalide" }, { status: 400, headers: cors });
  }

  const first_name = String(body.first_name || "").trim();
  const last_name = String(body.last_name || "").trim();
  const email = String(body.email || "").trim();
  const message = String(body.message || "").trim();
  const honeypot = String(body.website || "");
  const tStr = String(body.t || "0");
  const tNum = Number(tStr);

  // 1) Honeypot : bot detecte. On renvoie 200 silencieux pour ne pas lui
  //    donner d'indice qu'il a ete bloque.
  if (honeypot.trim() !== "") {
    console.warn("[contact] Honeypot rempli, message ignore. Valeur:", honeypot);
    return NextResponse.json({ success: true }, { headers: cors });
  }

  // 2) Time-check : moins de 3 secondes entre l'affichage du form et l'envoi
  //    = quasi-certainement un bot.
  if (!tNum || Date.now() - tNum < 3000) {
    console.warn("[contact] Time-check echoue, delai trop court ou t manquant");
    return NextResponse.json({ success: true }, { headers: cors });
  }

  // 3) Validation des champs obligatoires
  if (!first_name || !last_name || !email || !message) {
    return NextResponse.json(
      { error: "Tous les champs sont obligatoires." },
      { status: 400, headers: cors }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Email invalide." },
      { status: 400, headers: cors }
    );
  }
  if (message.length > 5000) {
    return NextResponse.json(
      { error: "Message trop long (5000 caractères max)." },
      { status: 400, headers: cors }
    );
  }

  // 4) Config SMTP
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const RECIPIENT = process.env.CONTACT_RECIPIENT || "contact@lenoncote.fr";

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error("[contact] SMTP_HOST / SMTP_USER / SMTP_PASS manquant cote env");
    return NextResponse.json(
      { error: "Configuration serveur incomplete. Reessayez plus tard." },
      { status: 500, headers: cors }
    );
  }

  // 5) Envoi via nodemailer
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // 465 = SMTPS, 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const subject = `Nouveau message — ${first_name} ${last_name}`;
  const textBody = [
    `Prénom : ${first_name}`,
    `Nom : ${last_name}`,
    `Email : ${email}`,
    "",
    "──────────────",
    "Message :",
    message,
    "",
    "──────────────",
    "Envoyé depuis https://lenoncote.fr/nous-contacter",
  ].join("\n");

  const htmlBody = `
<div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #101820;">
  <p><strong>Prénom :</strong> ${escapeHtml(first_name)}</p>
  <p><strong>Nom :</strong> ${escapeHtml(last_name)}</p>
  <p><strong>Email :</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
  <hr style="border:none;border-top:1px solid #ccc;margin:16px 0;" />
  <p><strong>Message :</strong></p>
  <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
  <hr style="border:none;border-top:1px solid #ccc;margin:16px 0;" />
  <p style="font-size:12px;color:#666;">
    Envoyé depuis <a href="https://lenoncote.fr/nous-contacter">https://lenoncote.fr/nous-contacter</a>
  </p>
</div>`.trim();

  try {
    await transporter.sendMail({
      from: `"Site Le Non Coté" <${SMTP_USER}>`,
      to: RECIPIENT,
      replyTo: `"${first_name} ${last_name}" <${email}>`,
      subject,
      text: textBody,
      html: htmlBody,
    });
    return NextResponse.json({ success: true }, { headers: cors });
  } catch (err) {
    console.error("[contact] Echec envoi SMTP :", err);
    return NextResponse.json(
      { error: "L'envoi a échoué. Réessayez plus tard ou écrivez directement à contact@lenoncote.fr." },
      { status: 502, headers: cors }
    );
  }
}
