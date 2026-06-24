import { ContactForm } from "./ContactForm";

export const dynamic = "force-dynamic";

export default function ContactPage() {
  return (
    <>
      <h1 style={{ marginTop: 0 }}>Contact us</h1>
      <p className="muted" style={{ maxWidth: 560, marginBottom: "1.25rem" }}>
        Found a bug, have an idea, or want a feature? Tell us below and it goes straight to our
        team. We read every message.
      </p>
      <ContactForm />
    </>
  );
}
