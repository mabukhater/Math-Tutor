"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function addChild(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const display_name = String(formData.get("display_name") ?? "").trim();
  const nominal_grade = Number(formData.get("nominal_grade"));
  const curriculum_id = String(formData.get("curriculum_id") ?? "");
  if (!display_name || ![3, 4, 5].includes(nominal_grade) || !curriculum_id) {
    redirect("/children/new?error=1");
  }

  // Validate the curriculum exists.
  const { data: curr } = await supabase
    .from("curricula")
    .select("id")
    .eq("id", curriculum_id)
    .single();
  if (!curr) redirect("/children/new?error=1");

  const { data: student, error } = await supabase
    .from("students")
    .insert({
      parent_id: user.id,
      display_name,
      nominal_grade,
      curriculum_id,
    })
    .select("id")
    .single();
  if (error || !student) redirect("/children/new?error=1");

  redirect(`/placement/${student.id}`);
}
