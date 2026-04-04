import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedKey = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;

  if (authHeader !== expectedKey) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();
  const supabase = createAdminClient();

  const subscriberData = {
    wp_user_id: body.user_id,
    login: body.login || null,
    email: body.email,
    first_name: body.first_name || null,
    last_name: body.last_name || null,
    user_type: body.user_type || null,
    investisseur_type: body.investisseur_type || null,
    societe: body.societe || null,
    departement: body.departement || null,
    newsletter: body.newsletter ?? false,
    recontacter: body.recontacter ?? false,
    cgu: body.cgu ?? false,
    email_verified: body.email_verified ?? false,
    registered_at: body.registered_at || null,
  };

  if (body.event === "user_updated") {
    const { error } = await supabase
      .from("subscribers")
      .update(subscriberData)
      .eq("wp_user_id", body.user_id);

    if (error) {
      // If not found, insert instead
      const { error: insertError } = await supabase
        .from("subscribers")
        .insert(subscriberData);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }
    }
  } else {
    const { error } = await supabase
      .from("subscribers")
      .upsert(subscriberData, { onConflict: "wp_user_id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true });
}
