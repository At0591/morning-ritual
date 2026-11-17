// src/utils/dates.ts
// Calendar dates in the user's LOCAL time zone.
//
// Never use `date.toISOString().split('T')[0]` for streaks or history: that is
// the UTC date. In India (UTC+5:30), local midnight is 18:30 the previous day
// in UTC, so a ritual done at 5 AM IST would be logged against yesterday.

/** 'YYYY-MM-DD' for the given moment in the device's local time zone. */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The local date key `days` calendar days away (negative = past). DST-safe. */
export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  // Noon avoids landing on the wrong day across daylight-saving changes.
  return localDateKey(new Date(y, m - 1, d + days, 12));
}

/** Whole calendar days from `fromKey` to `toKey` (e.g. yesterday to today = 1). */
export function daysBetween(fromKey: string, toKey: string): number {
  const [y1, m1, d1] = fromKey.split('-').map(Number);
  const [y2, m2, d2] = toKey.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}
