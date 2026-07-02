import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { kidEmail, kidPassword, validUsername, validPin } from "@/lib/kidAuth";

// After this many consecutive wrong PINs, lock the username for the cool-off
// window. A short PIN is only safe if it can't be tried thousands of times.
const MAX_FAILS = 8;
const LOCK_MINUTES = 15;

// Kid sign-in: username + PIN -> derived synthetic email/password -> session.
export async function POST(req: Request) {
  const { username, pin } = await req.json();
  if (!validUsername(username) || !validPin(pin))
    return NextResponse.json({ error: "bad_login" }, { status: 400 });

  const uname = String(username).toLowerCase();
  const admin = createAdminClient();

  // Per-account throttle (tracked in Postgres so it holds across instances).
  const { data: rec } = await admin
    .from("kid_login_attempts")
    .select("fails, locked_until")
    .eq("username", uname)
    .maybeSingle();
  const now = Date.now();
  if (rec?.locked_until && new Date(rec.locked_until).getTime() > now)
    return NextResponse.json({ error: "locked" }, { status: 429 });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: kidEmail(uname),
    password: kidPassword(uname, pin),
  });

  if (error) {
    const fails = (rec?.fails ?? 0) + 1;
    const locked = fails >= MAX_FAILS;
    await admin.from("kid_login_attempts").upsert({
      username: uname,
      // Reset the counter when we lock; the lock itself blocks further tries.
      fails: locked ? 0 : fails,
      locked_until: locked
        ? new Date(now + LOCK_MINUTES * 60_000).toISOString()
        : (rec?.locked_until ?? null),
      updated_at: new Date(now).toISOString(),
    });
    return NextResponse.json(
      { error: locked ? "locked" : "bad_login" },
      { status: locked ? 429 : 401 },
    );
  }

  // Success — clear the counter for this username.
  if (rec) await admin.from("kid_login_attempts").delete().eq("username", uname);
  return NextResponse.json({ ok: true });
}
