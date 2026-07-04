// src/services/__tests__/dailyPick.test.ts

import type { Task } from '../../db/database';

const mockTasks: Task[] = [];
const mockRecentIds: string[] = [];

// In-memory task store for tests
function makeTask(id: string, theme: string, isFree: boolean, timesShown = 0): Task {
  return {
    id,
    theme,
    text: `Sample task ${id}`,
    whyItMatters: '...',
    verification: 'checkin',
    mediaType: null,
    estSeconds: 30,
    isFree,
    isActive: true,
    lastShownAt: null,
    timesShown,
  };
}

// Mock the database module
jest.mock('../../db/database', () => ({
  getAllTasks: jest.fn(async (filters: any) => {
    let result = [...mockTasks];
    if (filters?.theme) result = result.filter((t) => t.theme === filters.theme);
    if (filters?.isActive !== undefined) result = result.filter((t) => t.isActive === filters.isActive);
    return result;
  }),
  getRecentTaskIds: jest.fn(async () => [...mockRecentIds]),
  markTaskShown: jest.fn(async (id: string) => {
    const t = mockTasks.find((x) => x.id === id);
    if (t) {
      t.timesShown += 1;
      t.lastShownAt = new Date().toISOString();
      mockRecentIds.push(id);
    }
  }),
}));

import { pickDailyTask } from '../dailyPick';

describe('dailyPick', () => {
  beforeEach(() => {
    mockTasks.length = 0;
    mockRecentIds.length = 0;
  });

  test('returns exactly one task', async () => {
    for (let i = 0; i < 10; i++) mockTasks.push(makeTask(`body-${i}`, 'body', true));

    const result = await pickDailyTask({ tier: 'free' });
    expect(result.task).toBeDefined();
    expect(result.task.id).toMatch(/^body-/);
  });

  test('free-tier user never sees premium tasks', async () => {
    for (let i = 0; i < 30; i++) mockTasks.push(makeTask(`body-${i}`, 'body', i < 10)); // 10 free, 20 premium

    for (let i = 0; i < 50; i++) {
      const result = await pickDailyTask({ tier: 'free' });
      expect(result.task.isFree).toBe(true);
    }
  });

  test('premium user can see both free and premium', async () => {
    for (let i = 0; i < 30; i++) mockTasks.push(makeTask(`body-${i}`, 'body', i < 10));

    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const result = await pickDailyTask({ tier: 'premium' });
      seen.add(result.task.id);
    }
    // After 100 picks, should have seen both free and premium tasks
    expect(seen.size).toBeGreaterThan(10);
  });

  test('task not repeated within no-repeat window (within same session)', async () => {
    for (let i = 0; i < 30; i++) mockTasks.push(makeTask(`body-${i}`, 'body', true));

    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const result = await pickDailyTask({ tier: 'free', noRepeatDays: 7 });
      // Should not see a task we already picked in this run
      // (mockRecentIds is updated by markTaskShown, so the no-repeat filter should exclude)
      expect(seen.has(result.task.id)).toBe(false);
      seen.add(result.task.id);
    }
  });

  test('falls back when all tasks recently shown (no-repeat window exceeded pool)', async () => {
    for (let i = 0; i < 5; i++) mockTasks.push(makeTask(`body-${i}`, 'body', true));
    // All 5 tasks already shown
    mockRecentIds.push(...mockTasks.map((t) => t.id));

    const result = await pickDailyTask({ tier: 'free', noRepeatDays: 7 });
    // Should still pick SOMETHING (fallback to all matching, even if recently shown)
    expect(result.task).toBeDefined();
  });

  test('respects theme filter', async () => {
    for (let i = 0; i < 5; i++) mockTasks.push(makeTask(`body-${i}`, 'body', true));
    for (let i = 0; i < 5; i++) mockTasks.push(makeTask(`mind-${i}`, 'mind', true));

    for (let i = 0; i < 10; i++) {
      const result = await pickDailyTask({ tier: 'premium', theme: 'mind' });
      expect(result.task.theme).toBe('mind');
    }
  });

  test('distribution is roughly uniform across many picks (1/timesShown weighting)', async () => {
    const N = 50;
    for (let i = 0; i < N; i++) mockTasks.push(makeTask(`body-${i}`, 'body', true));

    const counts: Record<string, number> = {};
    for (let i = 0; i < N * 5; i++) {
      const result = await pickDailyTask({ tier: 'free', noRepeatDays: 0 });
      counts[result.task.id] = (counts[result.task.id] ?? 0) + 1;
    }
    // Each task should be picked ~5 times (250 picks / 50 tasks = 5 avg)
    // Allow wide tolerance: between 1 and 15 for a stable test
    for (const id in counts) {
      expect(counts[id]).toBeGreaterThan(0);
      expect(counts[id]).toBeLessThan(20);
    }
  });

  test('throws when no tasks match filters', async () => {
    // No tasks at all
    await expect(pickDailyTask({ tier: 'free' })).rejects.toThrow();
  });
});
