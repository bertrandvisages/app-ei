import { NextResponse } from "next/server";
import { consumeNotifications } from "@/lib/image-notifications";

export async function GET() {
  const results = consumeNotifications();
  return NextResponse.json(results);
}
