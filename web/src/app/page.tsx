import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Landing() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="wrap">
      <div className="card">
        <span className="badge">US Common Core · Grades 3–5</span>
        <h1 style={{ marginTop: "0.75rem" }}>Math that follows your child.</h1>
        <p className="sub">
          Pick your child&apos;s curriculum, let a quick adaptive check place them at their
          real level, then a few daily questions on Telegram keep them on track.
        </p>
        <Link href="/login" className="btn">
          Get started
        </Link>
        <p className="muted" style={{ marginTop: "1rem", textAlign: "center" }}>
          Pricing coming soon — free during the trial.
        </p>
      </div>
    </div>
  );
}
