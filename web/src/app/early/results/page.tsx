import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email))
    return (
      <div className="wrap">
        <div className="card">
          <h2>Admins only</h2>
          <p className="sub">Signed in as {user.email}, which isn’t on the admin list.</p>
        </div>
      </div>
    );

  const admin = createAdminClient();
  const { data: views } = await admin.from("landing_views").select("variant, signed_up");
  const { data: signups } = await admin
    .from("waitlist")
    .select("email, variant, situation, created_at")
    .order("created_at", { ascending: false });

  const stat = (v: "A" | "B") => {
    const vs = (views ?? []).filter((r) => r.variant === v);
    const imp = vs.length;
    const sign = vs.filter((r) => r.signed_up).length;
    return { imp, sign, rate: imp ? Math.round((1000 * sign) / imp) / 10 : 0 };
  };
  const A = stat("A");
  const B = stat("B");
  const winner =
    A.imp >= 20 && B.imp >= 20 ? (A.rate > B.rate ? "A" : B.rate > A.rate ? "B" : "tie") : "—";

  const sitCounts: Record<string, number> = {};
  for (const s of signups ?? []) {
    const k = s.situation ?? "unspecified";
    sitCounts[k] = (sitCounts[k] ?? 0) + 1;
  }

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 760 }}>
        <h1>Waitlist A/B results</h1>
        <p className="sub">
          A = cross-curriculum continuity · B = rigor-first. Need ~20+ impressions/variant before
          trusting the rate.
        </p>

        <table className="ab-table">
          <thead>
            <tr>
              <th>Variant</th>
              <th>Impressions</th>
              <th>Signups</th>
              <th>Conversion</th>
            </tr>
          </thead>
          <tbody>
            <tr className={winner === "A" ? "win" : ""}>
              <td>A · continuity</td>
              <td>{A.imp}</td>
              <td>{A.sign}</td>
              <td>{A.rate}%</td>
            </tr>
            <tr className={winner === "B" ? "win" : ""}>
              <td>B · rigor-first</td>
              <td>{B.imp}</td>
              <td>{B.sign}</td>
              <td>{B.rate}%</td>
            </tr>
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Leading headline: <strong>{winner}</strong> · total signups: {(signups ?? []).length}
        </p>

        <h2 className="section-title" style={{ marginTop: "1.5rem" }}>
          Who’s signing up (the expat test)
        </h2>
        <ul className="tier-features">
          {Object.entries(sitCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => (
              <li key={k}>
                {k}: {n}
              </li>
            ))}
        </ul>

        <h2 className="section-title" style={{ marginTop: "1.5rem" }}>
          Recent signups
        </h2>
        <div className="result-list" style={{ maxHeight: 320, overflowY: "auto", fontSize: "0.85rem" }}>
          {(signups ?? []).slice(0, 50).map((s) => (
            <div key={s.email}>
              {s.email} · {s.variant} · {s.situation ?? "—"}
            </div>
          ))}
          {(signups ?? []).length === 0 && <p className="muted">No signups yet.</p>}
        </div>
      </div>
    </div>
  );
}
