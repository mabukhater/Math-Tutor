"use client";

import Link from "next/link";
import { useState } from "react";
import { addChild } from "./actions";
import { gradeLabel, GRADES } from "@/lib/curriculum";
import { suggestGrade } from "@/lib/agePlacement";

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
  source,
}: {
  curricula: Curr[];
  hasError: boolean;
  source?: "onboarding";
}) {
  const initial = curricula.find((c) => c.code === "common_core")?.id ?? curricula[0]?.id ?? "";
  const [currId, setCurrId] = useState(initial);
  const [birthdate, setBirthdate] = useState("");
  const [grade, setGrade] = useState(3);
  const [touchedGrade, setTouchedGrade] = useState(false);
  const selected = curricula.find((c) => c.id === currId);
  const noun = selected?.grade_noun ?? "Grade";
  const offset = selected?.grade_offset ?? 0;
  const code = selected?.code;

  const suggested = birthdate ? suggestGrade(new Date(birthdate), new Date()) : null;

  function onBirthdate(v: string) {
    setBirthdate(v);
    if (v && !touchedGrade) setGrade(suggestGrade(new Date(v), new Date()));
  }

  return (
    <div className="wrap">
      <div className="card">
        <h1>Add a child</h1>
        <p className="sub">We store a first name or nickname, birthdate, and level.</p>
        <form action={addChild}>
          {source && <input type="hidden" name="source" value={source} />}
          <label htmlFor="display_name">First name or nickname</label>
          <input id="display_name" name="display_name" required maxLength={40} />

          <label htmlFor="birthdate">Birthdate</label>
          <input
            id="birthdate"
            name="birthdate"
            type="date"
            value={birthdate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => onBirthdate(e.target.value)}
          />

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
          <select
            id="nominal_grade"
            name="nominal_grade"
            value={grade}
            onChange={(e) => {
              setTouchedGrade(true);
              setGrade(Number(e.target.value));
            }}
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(noun, offset, g, code)}
              </option>
            ))}
          </select>
          {suggested !== null && (
            <p className="muted" style={{ marginTop: "-0.4rem", marginBottom: "0.6rem", fontSize: "0.82rem" }}>
              Suggested from birthdate: <strong>{gradeLabel(noun, offset, suggested, code)}</strong> — you can
              change this.
            </p>
          )}

          {code === "ontario" && (
            <p className="muted" style={{ marginTop: "-0.2rem", marginBottom: "0.6rem", fontSize: "0.82rem" }}>
              Pick <strong>Grade 4</strong> to follow the full Sept–June Ontario year plan, week by week.
            </p>
          )}

          {hasError && <p className="err">Please enter a name and pick a curriculum and level.</p>}

          <button className="btn" type="submit">
            Add child
          </button>
          <p className="muted" style={{ textAlign: "center", marginTop: "0.6rem", fontSize: "0.82rem" }}>
            They’ll start at the beginning of this grade. You can run an optional level check anytime.
          </p>
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
