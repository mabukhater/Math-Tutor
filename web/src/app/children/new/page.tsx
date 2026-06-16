import Link from "next/link";
import { addChild } from "./actions";

export default async function NewChild({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="wrap">
      <div className="card">
        <h1>Add a child</h1>
        <p className="sub">We only store a first name or nickname and grade.</p>
        <form action={addChild}>
          <label htmlFor="display_name">First name or nickname</label>
          <input id="display_name" name="display_name" required maxLength={40} />

          <label htmlFor="nominal_grade">Grade</label>
          <select id="nominal_grade" name="nominal_grade" defaultValue="3">
            <option value="3">Grade 3</option>
            <option value="4">Grade 4</option>
            <option value="5">Grade 5</option>
          </select>

          <label htmlFor="curriculum">Curriculum</label>
          <select id="curriculum" name="curriculum" defaultValue="common_core" disabled>
            <option value="common_core">US Common Core</option>
          </select>

          {error && <p className="err">Please enter a name and pick a grade.</p>}

          <button className="btn" type="submit">
            Start placement
          </button>
        </form>
        <p style={{ marginTop: "1rem", textAlign: "center" }}>
          <Link href="/dashboard" className="muted">
            Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
