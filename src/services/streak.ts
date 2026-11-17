// src/services/streak.ts
// Pure streak maths, kept out of the UI so it can be unit-tested.

import { daysBetween } from '../utils/dates';

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null; // local 'YYYY-MM-DD'
  totalCompleted: number;
  graceDays: number; // missed days forgiven before the streak resets
}

export interface StreakUpdate {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string;
  totalCompleted: number;
  usedGraceDay: boolean;
  alreadyCountedToday: boolean;
}

/** The streak after completing a ritual on `todayKey` (local 'YYYY-MM-DD'). */
export function nextStreak(state: StreakState, todayKey: string): StreakUpdate {
  if (state.lastCompletedDate === todayKey) {
    return {
      currentStreak: state.currentStreak,
      longestStreak: state.longestStreak,
      lastCompletedDate: todayKey,
      totalCompleted: state.totalCompleted,
      usedGraceDay: false,
      alreadyCountedToday: true,
    };
  }

  const gap = state.lastCompletedDate ? daysBetween(state.lastCompletedDate, todayKey) : Infinity;
  const missedDays = gap - 1;
  let current: number;
  let usedGraceDay = false;
  if (gap === 1) {
    current = state.currentStreak + 1;
  } else if (missedDays >= 1 && missedDays <= state.graceDays) {
    current = state.currentStreak + 1;
    usedGraceDay = true;
  } else {
    current = 1;
  }

  return {
    currentStreak: current,
    longestStreak: Math.max(state.longestStreak, current),
    lastCompletedDate: todayKey,
    totalCompleted: state.totalCompleted + 1,
    usedGraceDay,
    alreadyCountedToday: false,
  };
}
