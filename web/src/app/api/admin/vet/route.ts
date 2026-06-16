import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/adminAuth";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!isAdminEmail(user.email))
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { error: null };
}

// List draft questions for review.
export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const url = new URL(req.url);
  const grade = url.searchParams.get("grade");
  const onePerSkill = url.searchParams.get("one_per_skill") === "1";

  const admin = createAdminClient();
  let query = admin
    .from("questions")
    .select(
      "id, stem, options, correct_index, explanation, difficulty, skills!inner(code, grade, sequence_position)",
    )
    .eq("status", "draft");
  if (grade) query = query.eq("skills.grade", Number(grade));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows = (data ?? []).map((r: any) => ({
    id: r.id as string,
    stem: r.stem as string,
    options: r.options as string[],
    correct_index: r.correct_index as number,
    explanation: r.explanation as string,
    difficulty: r.difficulty as number,
    skill_code: r.skills.code as string,
    grade: r.skills.grade as number,
    seq: r.skills.sequence_position as number,
  }));
  rows.sort((a, b) => a.seq - b.seq || a.difficulty - b.difficulty);

  if (onePerSkill) {
    const best = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const cur = best.get(r.skill_code);
      if (!cur || Math.abs(r.difficulty - 3) < Math.abs(cur.difficulty - 3)) best.set(r.skill_code, r);
    }
    rows = [...best.values()].sort((a, b) => a.seq - b.seq);
  }

  return NextResponse.json({ questions: rows });
}

// Set a question's status (vetted | retired | draft).
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const { questionId, status } = await req.json();
  if (!questionId || !["vetted", "retired", "draft"].includes(status))
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("questions").update({ status }).eq("id", questionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
