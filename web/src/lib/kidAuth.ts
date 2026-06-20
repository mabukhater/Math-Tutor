import { createHash } from "crypto";

// A kid logs in with username + PIN. Under the hood that maps to a Supabase Auth
// user with a synthetic email and a STRONG password derived from the PIN — so
// even though the child types a short PIN, the real account password is strong.
// The derivation uses a server-only pepper, so it can only happen server-side.

export function kidEmail(username: string): string {
  return `kid.${username.toLowerCase()}@kareem.academy`;
}

export function kidPassword(username: string, pin: string): string {
  const pepper = process.env.KID_LOGIN_PEPPER ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "kareem";
  return createHash("sha256").update(`${username.toLowerCase()}:${pin}:${pepper}`).digest("hex");
}

export function validUsername(u: unknown): u is string {
  return typeof u === "string" && /^[a-z0-9_]{3,20}$/.test(u.toLowerCase());
}

export function validPin(p: unknown): p is string {
  return typeof p === "string" && /^[0-9]{4,8}$/.test(p);
}
