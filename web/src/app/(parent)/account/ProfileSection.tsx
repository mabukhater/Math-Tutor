"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateParentProfile, type ParentProfile } from "@/lib/profileActions";

function addressLines(p: ParentProfile): string[] {
  const cityLine = [p.city, p.region, p.postal_code].filter(Boolean).join(", ");
  return [p.address_line1, p.address_line2, cityLine, p.country].filter(
    (x): x is string => !!x && x.length > 0,
  );
}

export function ProfileSection({ profile, email }: { profile: ParentProfile; email: string }) {
  const router = useRouter();
  // Show the read-only card once a profile exists; brand-new accounts start in edit mode.
  const [editing, setEditing] = useState(!profile.full_name);
  const [saving, setSaving] = useState(false);

  async function save(formData: FormData) {
    setSaving(true);
    await updateParentProfile(formData);
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    const addr = addressLines(profile);
    return (
      <div className="profile-summary">
        <div className="profile-summary-head">
          <span className="profile-summary-name">{profile.full_name}</span>
          <button className="profile-edit-btn" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
        <dl>
          <dt>Email</dt>
          <dd>{email}</dd>
          {profile.phone && (
            <>
              <dt>Phone</dt>
              <dd>{profile.phone}</dd>
            </>
          )}
          {addr.length > 0 && (
            <>
              <dt>Address</dt>
              <dd>
                {addr.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </dd>
            </>
          )}
        </dl>
      </div>
    );
  }

  return (
    <form action={save} className="profile-form">
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

      <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem" }}>
        <button className="btn" type="submit" disabled={saving} style={{ marginTop: 0 }}>
          {saving ? "Saving…" : "Save profile"}
        </button>
        {profile.full_name && (
          <button
            type="button"
            className="profile-edit-btn"
            onClick={() => setEditing(false)}
            disabled={saving}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
