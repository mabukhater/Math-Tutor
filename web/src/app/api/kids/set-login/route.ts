import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { kidEmail, kidPassword, validUsername, validPin } from "@/lib/kidAuth";

// Parent creates or resets a child's login (username + PIN). The kid login is a
// Supabase Auth user linked to the student via kid_logins.
export async function POST(req: Request) {
  const { studentId, username, pin } = await req.json();
  if (!studentId || !validUsername(username) || !validPin(pin))
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  const uname = String(username).toLowerCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: student } = await admin
    .from("students")
    .select("id, parent_id")
    .eq("id", studentId)
    .single();
  if (!student || student.parent_id !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Username must be globally unique (it maps to a synthetic email).
  const { data: taken } = await admin
    .from("kid_logins")
    .select("student_id")
    .eq("username", uname)
    .maybeSingle();
  if (taken && taken.student_id !== studentId)
    return NextResponse.json({ error: "username_taken" }, { status: 409 });

  const email = kidEmail(uname);
  const password = kidPassword(uname, pin);

  const { data: existing } = await admin
    .from("kid_logins")
    .select("kid_user_id")
    .eq("student_id", studentId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.kid_user_id as string, {
      email,
      password,
    });
    if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
    await admin.from("kid_logins").update({ username: uname }).eq("student_id", studentId);
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !created?.user)
      return NextResponse.json({ error: "create_failed" }, { status: 500 });
    const { error: linkErr } = await admin
      .from("kid_logins")
      .insert({ student_id: studentId, username: uname, kid_user_id: created.user.id });
    if (linkErr) {
      await admin.auth.admin.deleteUser(created.user.id); // roll back the orphan auth user
      return NextResponse.json({ error: "link_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, username: uname });
}
