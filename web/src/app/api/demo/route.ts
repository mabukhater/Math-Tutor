import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Public sample questions for the no-signup demo. These are vetted questions; it
// returns the answer so the widget can grade locally — fine for a few samples.
export async function GET() {
  const admin = createAdminClient();
  const { data: ids } = await admin.from("questions").select("id").eq("status", "vetted");
  if (!ids || ids.length === 0) return NextResponse.json({ questions: [] });

  // Always include up to 2 visual questions so the demo shows them off, then
  // fill the rest randomly.
  const { data: vids } = await admin
    .from("questions")
    .select("id")
    .eq("status", "vetted")
    .not("visual", "is", null);
  const visualPool = (vids ?? []).map((r) => r.id as string);
  const pick: string[] = [];
  for (let k = 0; k < 2 && visualPool.length; k++) {
    pick.push(visualPool.splice(Math.floor(Math.random() * visualPool.length), 1)[0]);
  }

  const pool = ids.map((r) => r.id as string).filter((id) => !pick.includes(id));
  while (pick.length < 6 && pool.length) {
    pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }

  const { data: qs } = await admin
    .from("questions")
    .select("id, stem, options, correct_index, explanation, option_explanations, visual, skills!inner(code, curricula!inner(name))")
    .in("id", pick);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questions = (qs ?? []).map((q: any) => ({
    id: q.id as string,
    stem: q.stem as string,
    options: q.options as string[],
    correctIndex: q.correct_index as number,
    explanation: q.explanation as string,
    optionExplanations: (q.option_explanations as string[] | null) ?? null,
    visual: q.visual ?? null,
    skillCode: q.skills?.code as string,
    curriculum: q.skills?.curricula?.name as string,
  }));

  return NextResponse.json({ questions });
}
