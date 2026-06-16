"use client";

import Link from "next/link";
import { useState } from "react";
import { addChild } from "./actions";
import { gradeLabel, GRADES } from "@/lib/curriculum";

interface Curr {
  id: string;
  code: string;
  name: string;
  grade_noun: string;
  grade_offset: number;
}

export default function NewChildForm({
  curricula,
  hasError,
}: {
  curricula: Curr[];
  hasError: boolean;
}) {
  const initial = curricula.find((c) => c.code === "common_core")?.id ?? curricula[0]?.id ?? "";
  const [currId, setCurrId] = useState(initial);
  const selected = curricula.find((c) => c.id === currId);
  const noun = selected?.grade_noun ?? "Grade";
  const offset = selected?.grade_offset ?? 0;
  const code = selected?.code;

  return (
    <div className="wrap">
      <div className="card">
        <h1>Add a child</h1>
        <p className="sub">We only store a first name or nickname and level.</p>
        <form action={addChild}>
          <label htmlFor="display_name">First name or nickname</label>
          <input id="display_name" name="display_name" required maxLength={40} />

          <label htmlFor="curriculum_id">Curriculum</label>
          <select
            id="curriculum_id"
            name="curriculum_id"
            value={currId}
            onChange={(e) => setCurrId(e.target.value)}
          >
            {curricula.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <label htmlFor="nominal_grade">Level</label>
          <select id="nominal_grade" name="nominal_grade" defaultValue="3">
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(noun, offset, g, code)}
              </option>
            ))}
          </select>

          {hasError && <p className="err">Please enter a name and pick a curriculum and level.</p>}

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
