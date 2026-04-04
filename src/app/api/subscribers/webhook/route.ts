import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHmac } from "node:crypto";

export async function POST(request: Request) {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const secret = process.env.WP_WEBHOOK_SECRET;

  // Verify HMAC signature if secret is configured
  if (secret) {
    const signature = request.headers.get("x-webhook-signature") || request.headers.get("X-Webhook-Signature");
    if (signature) {
      const expected = createHmac("sha256", secret).update(body).digest("hex");
      if (signature !== expected) {
        console.log("Webhook signature mismatch", { received: signature, expected });
        return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
      }
    }
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (!data.user_id || !data.email) {
    return NextResponse.json({ error: "user_id et email requis" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const subscriberData = {
    wp_user_id: data.user_id,
    login: data.login || null,
    email: data.email,
    first_name: data.first_name || null,
    last_name: data.last_name || null,
    user_type: data.user_type || null,
    investisseur_type: data.investisseur_type || null,
    societe: data.societe || null,
    departement: data.departement || null,
    newsletter: data.newsletter ?? false,
    recontacter: data.recontacter ?? false,
    cgu: data.cgu ?? false,
    email_verified: data.email_verified ?? false,
    registered_at: data.registered_at || null,
  };

  const { error } = await supabase
    .from("subscribers")
    .upsert(subscriberData, { onConflict: "wp_user_id" });

  if (error) {
    console.log("Supabase upsert error", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
