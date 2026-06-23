// Suggest a normalized grade (1-8) from a child's birthdate using a Sept-1
// school-year cutoff. Pure + date-injected so it is deterministic and testable.
// Grade 1 corresponds to roughly age 6 at the cutoff (grade = age - 5).

const MIN_GRADE = 1;
const MAX_GRADE = 8;

/** The most recent September 1 (UTC midnight) on or before `today`. */
export function schoolYearCutoff(today: Date): Date {
  const year = today.getUTCFullYear();
  const thisYearsCutoff = new Date(Date.UTC(year, 8, 1)); // month 8 = September
  if (today.getTime() >= thisYearsCutoff.getTime()) return thisYearsCutoff;
  return new Date(Date.UTC(year - 1, 8, 1));
}

/** Whole years between `birthdate` and `at`. */
function ageAt(birthdate: Date, at: Date): number {
  let age = at.getUTCFullYear() - birthdate.getUTCFullYear();
  const m = at.getUTCMonth() - birthdate.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < birthdate.getUTCDate())) age -= 1;
  return age;
}

/** Suggested normalized grade for a birthdate, clamped to 1-8. */
export function suggestGrade(birthdate: Date, today: Date): number {
  const age = ageAt(birthdate, schoolYearCutoff(today));
  const grade = age - 5;
  return Math.max(MIN_GRADE, Math.min(MAX_GRADE, grade));
}
