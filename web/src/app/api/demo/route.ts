import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Public sample questions for the no-signup demo. These are vetted questions; it
// returns the answer so the widget can grade locally — fine for a few samples.
export async function GET() {
  const admin = createAdminClient();
  const { data: ids } = await admin.from("questions").select("id").eq("status", "vetted");
  if (!ids || ids.length === 0) return NextResponse.json({ questions: [] });

  const pool = ids.map((r) => r.id as string);
  const pick: string[] = [];
  for (let k = 0; k < 6 && pool.length; k++) {
    pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }

  const { data: qs } = await admin
    .from("questions")
    .select("id, stem, options, correct_index, explanation, skills!inner(code, curricula!inner(name))")
    .in("id", pick);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questions = (qs ?? []).map((q: any) => ({
    id: q.id as string,
    stem: q.stem as string,
    options: q.options as string[],
    correctIndex: q.correct_index as number,
    explanation: q.explanation as string,
    skillCode: q.skills?.code as string,
    curriculum: q.skills?.curricula?.name as string,
  }));

  return NextResponse.json({ questions });
}
