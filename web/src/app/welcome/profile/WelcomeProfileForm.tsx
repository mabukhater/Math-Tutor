"use client";

import Link from "next/link";
import { updateParentProfile } from "@/lib/profileActions";

export function WelcomeProfileForm({ defaultName }: { defaultName: string }) {
  return (
    <form action={updateParentProfile} className="profile-form">
      <input type="hidden" name="redirectTo" value="/welcome/child" />
      <label htmlFor="full_name">Your name</label>
      <input id="full_name" name="full_name" defaultValue={defaultName} maxLength={120} autoFocus />
      <label htmlFor="address_line1">Address line 1</label>
      <input id="address_line1" name="address_line1" maxLength={200} />
      <label htmlFor="city">City</label>
      <input id="city" name="city" maxLength={120} />
      <label htmlFor="region">State / region</label>
      <input id="region" name="region" maxLength={120} />
      <label htmlFor="postal_code">Postal code</label>
      <input id="postal_code" name="postal_code" maxLength={40} />
      <label htmlFor="country">Country</label>
      <input id="country" name="country" maxLength={120} />
      <button className="btn" type="submit">Save &amp; continue</button>
      <p style={{ textAlign: "center", marginTop: "0.6rem" }}>
        <Link href="/welcome/child" className="muted">Skip for now</Link>
      </p>
    </form>
  );
}
