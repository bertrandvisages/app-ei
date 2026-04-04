import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
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
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
