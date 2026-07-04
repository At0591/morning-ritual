// src/db/__tests__/database.test.ts

import * as Database from '../database';
import tasksJson from '../../data/tasks.json';

describe('database', () => {
  beforeAll(async () => {
    await Database.openDatabase();
  });

  test('opens DB and seeds 1000 tasks', async () => {
    const tasks = await Database.getAllTasks({ isActive: true });
    expect(tasks.length).toBe(1000);
  });

  test('free-tier has exactly 120 tasks (30 per theme)', async () => {
    const free = await Database.getAllTasks({ isActive: true, isFree: true });
    expect(free.length).toBe(120);

    const themes = ['body', 'mind', 'brain', 'creative'];
    for (const t of themes) {
      const cnt = free.filter((task) => task.theme === t).length;
      expect(cnt).toBe(30);
    }
  });

  test('themes are distributed equally: 250 per theme', async () => {
    const themes = ['body', 'mind', 'brain', 'creative'];
    for (const t of themes) {
      const tasks = await Database.getAllTasks({ theme: t, isActive: true });
      expect(tasks.length).toBe(250);
    }
  });

  test('task structure matches tasks.json source', () => {
    const sample = tasksJson[0];
    expect(sample).toHaveProperty('id');
    expect(sample).toHaveProperty('theme');
    expect(sample).toHaveProperty('text');
    expect(sample).toHaveProperty('whyItMatters');
    expect(sample).toHaveProperty('verification');
    expect(sample).toHaveProperty('estSeconds');
    expect(sample).toHaveProperty('isFree');
  });

  test('streak is initialized with zeros', async () => {
    const s = await Database.getStreak();
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(0);
    expect(s.totalCompleted).toBe(0);
    expect(s.lastCompletedDate).toBeNull();
  });

  test('settings: get/set round-trip', async () => {
    await Database.setSetting('alarm_time', '07:00');
    const v = await Database.getSetting('alarm_time');
    expect(v).toBe('07:00');
  });

  test('markTaskShown stamps lastShownAt and increments timesShown', async () => {
    const before = await Database.getTaskById('body-001');
    expect(before?.lastShownAt).toBeNull();
    expect(before?.timesShown).toBe(0);

    const now = new Date().toISOString();
    await Database.markTaskShown('body-001', now);

    const after = await Database.getTaskById('body-001');
    expect(after?.lastShownAt).toBe(now);
    expect(after?.timesShown).toBe(1);
  });
});
