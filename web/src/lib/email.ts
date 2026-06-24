// Minimal transactional email via Resend's REST API (no SDK dependency).
// Configure RESEND_API_KEY (and optionally CONTACT_TO_EMAIL / CONTACT_FROM_EMAIL).
// Until a domain is verified in Resend, the default sender (onboarding@resend.dev)
// can still deliver to the account owner's own inbox. If unconfigured, returns
// { sent: false } so callers can still persist the message.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendContactEmail(input: {
  fromName: string;
  fromEmail: string;
  category: string;
  subject: string;
  message: string;
}): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, error: "email_not_configured" };

  const to = process.env.CONTACT_TO_EMAIL ?? "mabukhater@gmail.com";
  const from = process.env.CONTACT_FROM_EMAIL ?? "Astute Academy <onboarding@resend.dev>";
  const subjectLine = `[Astute] ${input.category || "Message"}: ${input.subject}`
    .replace(/[\r\n]+/g, " ")
    .slice(0, 200);
  const text =
    `New ${input.category || "message"} from a parent\n\n` +
    `From: ${input.fromName || "(no name)"} <${input.fromEmail || "unknown"}>\n` +
    `Category: ${input.category || "—"}\n` +
    `Subject: ${input.subject}\n\n` +
    `${input.message}\n`;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        reply_to: input.fromEmail || undefined,
        subject: subjectLine,
        text,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { sent: false, error: `resend_${res.status}: ${t.slice(0, 140)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: String(e).slice(0, 140) };
  }
}
