// Pure helpers for the morning flow screens (kept free of UI and native code
// so they can be tested directly).

export const SUN_TAPS_NEEDED = 5;
export const SUN_SIZE = 92;

/** Where the sun sits after `taps` taps: lower to higher, random across. */
export function sunPosition(taps: number, width: number, height: number, random: number) {
  const progress = Math.min(taps, SUN_TAPS_NEEDED) / SUN_TAPS_NEEDED;
  return {
    left: Math.round(random * Math.max(0, width - SUN_SIZE)),
    top: Math.round(Math.max(0, height - SUN_SIZE) * (0.85 - progress * 0.7)),
  };
}

const SUGGESTIONS = [
  "I'm grateful for my morning coffee",
  "Today I'll finish the one thing that matters",
  "I'll call someone I miss",
  "I'm grateful for a good night's sleep",
  "Today I'll take a walk outside",
  "I'll be patient with myself today",
  "I'm looking forward to lunch with someone",
  "Today I'll drink enough water",
  "I'm grateful for someone who helped me this week",
];

/** Three suggestions that change each day but stay the same within a day. */
export function suggestionsFor(date: Date): string[] {
  const day = Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000);
  const start = (day * 3) % SUGGESTIONS.length;
  return [0, 1, 2].map((i) => SUGGESTIONS[(start + i) % SUGGESTIONS.length]);
}
