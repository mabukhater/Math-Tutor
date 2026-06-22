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
  if (!display_name || !(nominal_grade >= 1 && nominal_grade <= 8) || !curriculum_id) {
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

  // Place the child at the START of their chosen grade — no assessment required.
  // The parent can run the optional assessment later to fine-tune the level.
  const { data: firstSkill } = await supabase
    .from("skills")
    .select("sequence_position")
    .eq("curriculum_id", curriculum_id)
    .eq("grade", nominal_grade)
    .order("sequence_position", { ascending: true })
    .limit(1)
    .maybeSingle();
  await supabase
    .from("students")
    .update({
      current_skill_index: firstSkill?.sequence_position ?? 0,
      placement_completed: true,
    })
    .eq("id", student.id);

  redirect("/dashboard");
}
