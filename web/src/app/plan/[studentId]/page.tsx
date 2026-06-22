import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudent } from "@/lib/access";
import { getYearPlan } from "@/lib/yearPlanServer";
import { Check } from "@/components/icons";

export const dynamic = "force-dynamic";

function monthLabel(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleString("en-US", { month: "long" });
}
function dayLabel(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleString("en-US", { month: "short", day: "numeric" });
}

export default async function PlanPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  const access = await resolveStudent(supabase, admin, studentId);
  if (!access) redirect("/login");
  const student = access.student;
  const isKid = access.role === "kid";

  const plan = await getYearPlan(admin, student);
  if (!plan) notFound();

  const pace =
    plan.currentWeek > plan.numWeeks
      ? { text: "Year complete! 🎉", cls: "on" }
      : plan.currentWeek >= plan.expectedWeek
        ? { text: "On pace 🎯", cls: "on" }
        : { text: `${plan.expectedWeek - plan.currentWeek} week(s) behind`, cls: "behind" };
  const covPct = plan.mathTotal ? Math.round((100 * plan.mathCovered) / plan.mathTotal) : 0;

  let lastMonth = "";

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 760 }}>
        <div className="row" style={{ marginBottom: "0.25rem" }}>
          <h1 style={{ margin: 0 }}>
            {student.display_name ? `${student.display_name}’s year` : "Year plan"}
          </h1>
          <Link href={isKid ? "/me" : "/dashboard"} className="muted home-link">
            {isKid ? "← Home" : "Dashboard"}
          </Link>
        </div>
        <p className="sub">
          Grade 4 · Ontario · {plan.yearLabel} — your whole year, week by week.
        </p>

        <div className="yp-head">
          <div className={"yp-pace " + pace.cls}>{pace.text}</div>
          <div className="yp-week">
            Week {Math.min(plan.currentWeek, plan.numWeeks)} of {plan.numWeeks}
          </div>
        </div>

        <div className="yp-cov">
          <div className="yp-cov-row">
            <span>Math curriculum covered</span>
            <strong>
              {plan.mathCovered}/{plan.mathTotal}
            </strong>
          </div>
          <div className="ladder-bar">
            <div style={{ width: `${covPct}%` }} />
          </div>
        </div>

        <div className="yp-go">
          <Link href={`/learn/${studentId}`} className="btn">
            Do this week’s math →
          </Link>
          <Link href={`/reading/${studentId}`} className="btn btn-ghost">
            Reading →
          </Link>
        </div>

        <div className="yp-weeks">
          {plan.weeks.map((w) => {
            const month = monthLabel(w.startDate);
            const showMonth = month !== lastMonth;
            lastMonth = month;
            const isCurrent = w.weekNo === plan.currentWeek;
            return (
              <div key={w.weekNo}>
                {showMonth && <div className="yp-month">{month}</div>}
                <div className={"yp-wk" + (w.done ? " done" : "") + (isCurrent ? " current" : "")}>
                  <div className="yp-wk-no">
                    {w.done ? <Check size={15} /> : w.weekNo}
                  </div>
                  <div className="yp-wk-body">
                    <div className="yp-wk-title">
                      Week {w.weekNo} · {w.title}
                    </div>
                    <div className="yp-wk-items">
                      {w.items.map((it, i) => (
                        <span key={i} className={"yp-chip " + it.subject + (it.done ? " done" : "")}>
                          {it.subject === "math" ? "Math" : "Reading"}
                          {it.done ? " ✓" : ""}
                        </span>
                      ))}
                      {isCurrent && <span className="yp-here">you’re here</span>}
                    </div>
                  </div>
                  <div className="yp-wk-date">{dayLabel(w.startDate)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
