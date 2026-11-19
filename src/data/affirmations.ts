// src/data/affirmations.ts
// Daily reflections for the Home card: plain, kind, and no claims we can't back up.
// Picked based on day of year so each day of the year gets the same one.

const affirmations = [
  "Getting up today counts, even if nothing else goes to plan.",
  "Groggy is normal for the first few minutes. It passes.",
  "If you can, get some daylight soon after you wake.",
  "One small good thing is enough for this morning.",
  "Some mornings are harder than others. You got up anyway.",
  "A glass of water before your phone is a good start.",
  "Skipping the ritual today is fine. Getting up was the main thing.",
  "Your journal is only for you. Write it however you like.",
  "A slow morning is still a morning you showed up for.",
  "Open a window or step outside for a minute if you can.",
  "Bedtime decides a lot about how this morning felt.",
  "You don't have to feel ready to start the day.",
  "Write down one thing you're looking forward to.",
  "Rest days are part of keeping a habit, not a break from it.",
  "If yesterday went badly, today is a new count.",
  "Five minutes for yourself before the day starts is plenty.",
  "Notice one thing that went right this morning.",
  "Stretch for a moment before you check messages.",
  "You set this alarm for a reason. Today you kept it.",
  "Breakfast, water, daylight. Pick one if that's all you have time for.",
  "The first few minutes don't have to be productive.",
  "Be as kind to yourself this morning as you'd be to a friend.",
  "A missed morning doesn't undo the ones before it.",
  "Try going to bed fifteen minutes earlier tonight.",
  "What's one thing you can make easier for yourself today?",
  "You're up. That was the point of the alarm.",
  "Quiet mornings count too.",
  "Write one line about how you slept.",
  "Small and steady is a good pace for a morning.",
  "Thank yourself for getting up. It wasn't nothing.",
];

export function getTodayAffirmation(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return affirmations[dayOfYear % affirmations.length];
}
