import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Delete a child and all their data. FKs to students are ON DELETE CASCADE, so
// removing the student row clears attempts, blocks, progress, sessions, and the
// kid login; the kid's auth user is removed separately.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const admin = createAdminClient();
  const { data: student } = await admin
    .from("students")
    .select("id, parent_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student || student.parent_id !== user.id)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  // Grab the kid's auth user before the cascade removes the kid_logins row.
  const { data: kl } = await admin
    .from("kid_logins")
    .select("kid_user_id")
    .eq("student_id", studentId)
    .maybeSingle();

  const { error } = await admin.from("students").delete().eq("id", studentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (kl?.kid_user_id) {
    try {
      await admin.auth.admin.deleteUser(kl.kid_user_id as string);
    } catch {
      // The student and their data are already gone; an orphaned auth user is harmless.
    }
  }
  return NextResponse.json({ ok: true });
}
