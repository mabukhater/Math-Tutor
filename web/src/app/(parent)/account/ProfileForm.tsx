"use client";

import { updateParentProfile } from "@/lib/profileActions";
import type { ParentProfile } from "@/lib/profileActions";

export function ProfileForm({ profile, email }: { profile: ParentProfile; email: string }) {
  return (
    <form action={updateParentProfile} className="profile-form">
      <label htmlFor="full_name">Full name</label>
      <input id="full_name" name="full_name" defaultValue={profile.full_name ?? ""} maxLength={120} />

      <label htmlFor="email-display">Email</label>
      <input id="email-display" value={email} disabled />

      <label htmlFor="phone">Phone (optional)</label>
      <input id="phone" name="phone" defaultValue={profile.phone ?? ""} maxLength={40} />

      <label htmlFor="address_line1">Address line 1</label>
      <input id="address_line1" name="address_line1" defaultValue={profile.address_line1 ?? ""} maxLength={200} />

      <label htmlFor="address_line2">Address line 2</label>
      <input id="address_line2" name="address_line2" defaultValue={profile.address_line2 ?? ""} maxLength={200} />

      <label htmlFor="city">City</label>
      <input id="city" name="city" defaultValue={profile.city ?? ""} maxLength={120} />

      <label htmlFor="region">State / region</label>
      <input id="region" name="region" defaultValue={profile.region ?? ""} maxLength={120} />

      <label htmlFor="postal_code">Postal code</label>
      <input id="postal_code" name="postal_code" defaultValue={profile.postal_code ?? ""} maxLength={40} />

      <label htmlFor="country">Country</label>
      <input id="country" name="country" defaultValue={profile.country ?? ""} maxLength={120} />

      <button className="btn" type="submit">Save profile</button>
    </form>
  );
}
