// src/services/dailyPick.ts
// Weighted-random daily task picker.
// Goals:
//   1. Surface all 1000 tasks roughly equally over time
//   2. Never repeat a task within the no-repeat window (default 7 days)
//   3. Respect tier (free users only see isFree tasks)
//
// Algorithm: inverse-frequency weighting.
//   weight(task) = 1 / (1 + timesShown)
// This gives a 100%-boost to never-shown tasks, then gradually equalizes.
// With 1000 tasks and 1/day, the user sees all 1000 within ~3 years.

import { Task, getAllTasks, getRecentTaskIds, markTaskShown } from '../db/database';

export interface PickOptions {
  theme?: string;            // 'body' | 'mind' | 'brain' | 'creative' | undefined (any)
  tier: 'free' | 'premium' | 'trial';
  noRepeatDays?: number;     // default 7
  asOf?: Date;               // for testability; default new Date()
}

export interface PickResult {
  task: Task;
  candidatePoolSize: number; // for debugging / stats
  excludedByRepeat: number;
  excludedByTier: number;
}

/**
 * Pick one task using weighted-random inverse-frequency.
 * Mutates DB: calls markTaskShown on the chosen task.
 */
export async function pickDailyTask(options: PickOptions): Promise<PickResult> {
  const { tier, theme, noRepeatDays = 7, asOf = new Date() } = options;

  // 1. Load candidate pool
  const allMatchingTheme = await getAllTasks({
    theme,
    isActive: true,
  });

  // 2. Filter by tier
  const tierFiltered =
    tier === 'free'
      ? allMatchingTheme.filter((t) => t.isFree)
      : allMatchingTheme; // premium + trial see everything

  // 3. Exclude recently-shown
  const recentIds = new Set(await getRecentTaskIds(noRepeatDays));
  const eligible = tierFiltered.filter((t) => !recentIds.has(t.id));

  // 4. Fallback: if no eligible tasks, relax the repeat window
  let candidatePool = eligible;
  let excludedByRepeat = tierFiltered.length - eligible.length;
  if (candidatePool.length === 0) {
    candidatePool = tierFiltered;
    excludedByRepeat = 0;
  }

  if (candidatePool.length === 0) {
    throw new Error(
      `pickDailyTask: no tasks available for tier=${tier}, theme=${theme ?? 'any'}`
    );
  }

  // 5. Weighted-random pick (inverse-frequency)
  const weights = candidatePool.map((t) => 1 / (1 + t.timesShown));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * totalWeight;
  let chosenIdx = 0;
  for (let i = 0; i < candidatePool.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      chosenIdx = i;
      break;
    }
  }
  const chosen = candidatePool[chosenIdx];

  // 6. Mark as shown
  await markTaskShown(chosen.id, asOf.toISOString());

  return {
    task: chosen,
    candidatePoolSize: candidatePool.length,
    excludedByRepeat,
    excludedByTier: allMatchingTheme.length - tierFiltered.length,
  };
}
