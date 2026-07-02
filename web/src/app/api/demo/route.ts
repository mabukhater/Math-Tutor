import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const DEMO_SIZE = 6;

// A STABLE, small set of sample question ids for the public no-signup demo.
// Deterministic (ordered by id) so this unauthenticated endpoint can never be
// used to harvest correct answers for the whole vetted bank — only these few
// samples are ever gradable, and the answer is revealed only server-side (POST)
// after the visitor picks. Includes up to 2 visual questions to show them off.
async function demoQuestionIds(admin: SupabaseClient): Promise<string[]> {
  const { data: vids } = await admin
    .from("questions")
    .select("id")
    .eq("status", "vetted")
    .not("visual", "is", null)
    .order("id")
    .limit(2);
  const pick = (vids ?? []).map((r) => r.id as string);

  const { data: rest } = await admin
    .from("questions")
    .select("id")
    .eq("status", "vetted")
    .order("id")
    .limit(DEMO_SIZE + pick.length);
  for (const r of rest ?? []) {
    if (pick.length >= DEMO_SIZE) break;
    const id = r.id as string;
    if (!pick.includes(id)) pick.push(id);
  }
  return pick.slice(0, DEMO_SIZE);
}

// Public sample questions — WITHOUT the answer key. correct_index / explanations
// never leave the server here; grading happens in POST.
export async function GET() {
  const admin = createAdminClient();
  const ids = await demoQuestionIds(admin);
  if (ids.length === 0) return NextResponse.json({ questions: [] });

  const { data: qs } = await admin
    .from("questions")
    .select("id, stem, options, visual, skills!inner(code, curricula!inner(name))")
    .in("id", ids);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = new Map((qs ?? []).map((q: any) => [q.id as string, q]));
  const questions = ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((q: any) => ({
      id: q.id as string,
      stem: q.stem as string,
      options: q.options as string[],
      visual: q.visual ?? null,
      skillCode: q.skills?.code as string,
      curriculum: q.skills?.curricula?.name as string,
    }));

  return NextResponse.json({ questions });
}

// Grade one demo answer server-side. Only questions in the fixed demo set are
// gradable, so this cannot be used as a bank-wide answer-key oracle.
export async function POST(req: Request) {
  const { id, selectedIndex } = await req.json();
  if (typeof id !== "string" || typeof selectedIndex !== "number")
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const admin = createAdminClient();
  const ids = await demoQuestionIds(admin);
  if (!ids.includes(id))
    return NextResponse.json({ error: "not a demo question" }, { status: 400 });

  const { data: q } = await admin
    .from("questions")
    .select("correct_index, explanation, option_explanations")
    .eq("id", id)
    .single();
  if (!q) return NextResponse.json({ error: "not found" }, { status: 404 });

  const correctIndex = q.correct_index as number;
  const correct = selectedIndex === correctIndex;
  const oe = (q.option_explanations as string[] | null) ?? null;
  return NextResponse.json({
    correct,
    correctIndex,
    whyWrong: !correct ? (oe?.[selectedIndex] ?? null) : null,
    correctExplanation: oe?.[correctIndex] ?? (q.explanation as string),
  });
}
