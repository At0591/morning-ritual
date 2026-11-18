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

/**
 * Step 3 prompts. Each comes from a sourced ritual (the writing ones moved
 * here from the ritual list): tapping it puts the starter in the box for the
 * user to finish. `source` is a key into src/data/sources.json.
 */
export interface GoodThingPrompt {
  id: string;
  label: string;
  starter: string;
  source: string;
}

export const GOOD_THING_PROMPTS: GoodThingPrompt[] = [
  { id: 'm01', label: "Something I'm grateful for", starter: "I'm grateful for ", source: 'S12' },
  { id: 'm02', label: 'Something that went well yesterday', starter: 'Yesterday went well when ', source: 'S13' },
  { id: 'm04', label: 'How I feel right now', starter: 'Right now I feel ', source: 'S15' },
  { id: 'm08', label: 'Me, a year from now', starter: 'A year from now, I ', source: 'S18' },
  { id: 'm11', label: "Someone I'll reach out to today", starter: "Today I'll message ", source: 'S34' },
  { id: 'm13', label: "A person I'm grateful for", starter: "I'm grateful to ", source: 'S12' },
];

/** Three prompts that change each day but stay the same within a day. */
export function suggestionsFor(date: Date): GoodThingPrompt[] {
  const day = Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000);
  const start = (day * 3) % GOOD_THING_PROMPTS.length;
  return [0, 1, 2].map((i) => GOOD_THING_PROMPTS[(start + i) % GOOD_THING_PROMPTS.length]);
}
