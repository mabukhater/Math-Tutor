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
  const birthdateRaw = String(formData.get("birthdate") ?? "").trim();
  const birthdate = /^\d{4}-\d{2}-\d{2}$/.test(birthdateRaw) ? birthdateRaw : null;
  const source = String(formData.get("source") ?? "");
  const errorTo = source === "onboarding" ? "/welcome/child?error=1" : "/children/new?error=1";
  if (!display_name || !(nominal_grade >= 1 && nominal_grade <= 8) || !curriculum_id) {
    redirect(errorTo);
  }

  // Validate the curriculum exists.
  const { data: curr } = await supabase
    .from("curricula")
    .select("id, code")
    .eq("id", curriculum_id)
    .single();
  if (!curr) redirect(errorTo);

  // Ontario Grade 4 enrolls in the structured Sept-June year plan, if one exists.
  let year_plan_id: string | null = null;
  if (curr.code === "ontario" && nominal_grade === 4) {
    const { data: yp } = await supabase
      .from("year_plans")
      .select("id")
      .eq("curriculum_id", curriculum_id)
      .eq("grade", 4)
      .order("year_label", { ascending: false })
      .limit(1)
      .maybeSingle();
    year_plan_id = yp?.id ?? null;
  }

  const { data: student, error } = await supabase
    .from("students")
    .insert({
      parent_id: user.id,
      display_name,
      nominal_grade,
      curriculum_id,
      year_plan_id,
      birthdate,
    })
    .select("id")
    .single();
  if (error || !student) redirect(errorTo);

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

  if (source === "onboarding") {
    await supabase.from("parents").update({ onboarding_completed: true }).eq("id", user.id);
  }

  redirect("/dashboard");
}
