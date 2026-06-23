import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Build the PUBLIC base URL from forwarded headers — req.url behind Railway's
// proxy is the container's internal 0.0.0.0:8080, which the browser can't reach.
function baseUrl(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "astute.academy";
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${baseUrl(req)}/signed-out`, { status: 303 });
}
