import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NewChildForm from "@/app/children/new/NewChildForm";
import { finishOnboarding } from "@/lib/profileActions";

export const dynamic = "force-dynamic";

export default async function WelcomeChild({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: curricula } = await supabase
    .from("curricula")
    .select("id, code, name, grade_noun, grade_offset")
    .order("name");

  return (
    <div>
      <p className="muted" style={{ fontSize: "0.8rem", textAlign: "center", marginTop: "1rem" }}>
        Step 2 of 2
      </p>
      <NewChildForm curricula={curricula ?? []} hasError={error === "1"} source="onboarding" />
      <form action={finishOnboarding} style={{ textAlign: "center", marginTop: "-1rem" }}>
        <button
          className="muted"
          type="submit"
          style={{ background: "none", border: "none", cursor: "pointer" }}
        >
          Skip — I’ll add a child later
        </button>
      </form>
    </div>
  );
}
