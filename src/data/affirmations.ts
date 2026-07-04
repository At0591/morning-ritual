// src/data/affirmations.ts
// Daily affirmations — gentle, non-preachy, science-flavored where possible.
// Picked based on day of year so each day of the year gets the same one.

const affirmations = [
  "Small consistent acts compound into extraordinary lives.",
  "The first 30 minutes of your day shape the next 16 hours.",
  "Mornings are for what you choose, not what you're forced into.",
  "You don't need motivation. You need a ritual.",
  "A small win before 9 AM beats a big plan after.",
  "The task isn't the point. The showing up is.",
  "Be the person your 7 AM self is proud of.",
  "Today's ritual is tomorrow's identity.",
  "What you do when no one's watching is who you are.",
  "A morning done with intention is a day done with grace.",
  "The morning belongs to those who claim it.",
  "Tiny acts of care for yourself are not selfish. They're foundational.",
  "Mornings are where the best version of you lives.",
  "You are building something. One morning at a time.",
  "Future you is grateful for what present you does at sunrise.",
  "Streaks aren't about perfection. They're about returning.",
  "Wake. Choose. Begin.",
  "The hardest part is opening your eyes. The rest is just doing.",
  "Your morning is a vote for the kind of person you want to be.",
  "Calm is a practice. Mornings are where you practice it.",
  "Today, do one thing slowly and on purpose.",
  "The world won't pause for your morning. So make your morning pause-worthy.",
  "Awareness before action. Always.",
  "Body first, mind follows. Lead with breath.",
  "Show up. Even when you don't want to. Especially then.",
  "Discipline is choosing what you want most over what you want now.",
  "Rituals are how humans turn intentions into outcomes.",
  "A morning well-spent is a day half-won.",
  "The sunrise doesn't ask for permission. Neither should you.",
  "Today's small task is tomorrow's habit.",
  "Be present. Be deliberate. Begin.",
];

export function getTodayAffirmation(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return affirmations[dayOfYear % affirmations.length];
}
