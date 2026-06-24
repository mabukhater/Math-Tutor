"use client";

import { useState } from "react";

const CATEGORIES = ["Bug report", "Feature request", "Idea / suggestion", "Question", "Other"];

export function ContactForm() {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setErr("Please add a subject and a message.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, subject, message }),
      });
      if (r.ok) {
        setDone(true);
        setSubject("");
        setMessage("");
      } else {
        setErr("Couldn’t send. Please try again.");
      }
    } catch {
      setErr("Couldn’t send. Please try again.");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="profile-summary" style={{ maxWidth: 560 }}>
        <strong>Thanks — we got your message.</strong>
        <p className="muted" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
          We read every note and will follow up if it needs a reply.
        </p>
        <button
          className="profile-edit-btn"
          style={{ marginTop: "0.9rem" }}
          onClick={() => setDone(false)}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="profile-form" style={{ maxWidth: 560 }}>
      <label htmlFor="category">What’s this about?</label>
      <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <label htmlFor="subject">Subject</label>
      <input
        id="subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={200}
        placeholder="A short summary"
      />

      <label htmlFor="message">Details</label>
      <textarea
        id="message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={5000}
        rows={6}
        placeholder="Tell us what you need, what’s broken, or your idea…"
      />

      {err && <p className="err">{err}</p>}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
