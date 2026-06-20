import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { kidEmail, kidPassword, validUsername, validPin } from "@/lib/kidAuth";

// Kid sign-in: username + PIN -> derived synthetic email/password -> session.
export async function POST(req: Request) {
  const { username, pin } = await req.json();
  if (!validUsername(username) || !validPin(pin))
    return NextResponse.json({ error: "bad_login" }, { status: 400 });

  const uname = String(username).toLowerCase();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: kidEmail(uname),
    password: kidPassword(uname, pin),
  });
  if (error) return NextResponse.json({ error: "bad_login" }, { status: 401 });

  return NextResponse.json({ ok: true });
}
