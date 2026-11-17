import { nextStreak, StreakState } from '../streak';
import { daysBetween, localDateKey, shiftDateKey } from '../../utils/dates';

const base: StreakState = {
  currentStreak: 4,
  longestStreak: 9,
  lastCompletedDate: '2026-11-16',
  totalCompleted: 20,
  graceDays: 0,
};

describe('local dates', () => {
  test('localDateKey uses the local calendar day, not UTC', () => {
    // 5:00 AM local time is still "today" locally even where UTC is still yesterday.
    const earlyMorning = new Date(2026, 10, 17, 5, 0, 0);
    expect(localDateKey(earlyMorning)).toBe('2026-11-17');
  });

  test('shiftDateKey crosses month and year boundaries', () => {
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDateKey('2028-03-01', -1)).toBe('2028-02-29');
  });

  test('daysBetween counts calendar days', () => {
    expect(daysBetween('2026-11-16', '2026-11-17')).toBe(1);
    expect(daysBetween('2026-11-17', '2026-11-17')).toBe(0);
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
  });
});

describe('nextStreak', () => {
  test('consecutive day extends the streak', () => {
    const r = nextStreak(base, '2026-11-17');
    expect(r.currentStreak).toBe(5);
    expect(r.totalCompleted).toBe(21);
    expect(r.usedGraceDay).toBe(false);
  });

  test('second completion on the same day changes nothing', () => {
    const r = nextStreak({ ...base, lastCompletedDate: '2026-11-17' }, '2026-11-17');
    expect(r.alreadyCountedToday).toBe(true);
    expect(r.currentStreak).toBe(4);
    expect(r.totalCompleted).toBe(20);
  });

  test('a missed day resets the streak without grace days', () => {
    expect(nextStreak(base, '2026-11-18').currentStreak).toBe(1);
  });

  test('grace days forgive missed days', () => {
    const r = nextStreak({ ...base, graceDays: 1 }, '2026-11-18');
    expect(r.currentStreak).toBe(5);
    expect(r.usedGraceDay).toBe(true);
    expect(nextStreak({ ...base, graceDays: 1 }, '2026-11-19').currentStreak).toBe(1);
  });

  test('first ever completion starts at 1', () => {
    expect(nextStreak({ ...base, lastCompletedDate: null, currentStreak: 0 }, '2026-11-17').currentStreak).toBe(1);
  });

  test('longest streak is kept when beaten', () => {
    const r = nextStreak({ ...base, currentStreak: 9 }, '2026-11-17');
    expect(r.longestStreak).toBe(10);
  });
});
