// src/db/__tests__/database.test.ts

import * as Database from '../database';
import ritualsJson from '../../data/rituals.json';

const THEMES = ['body', 'mind', 'brain', 'creative'];

describe('database', () => {
  beforeAll(async () => {
    await Database.openDatabase();
  });

  test('seeds every ritual from rituals.json', async () => {
    const tasks = await Database.getAllTasks({ isActive: true });
    expect(tasks.length).toBe(ritualsJson.length);
  });

  test('every theme has at least one ritual', async () => {
    for (const theme of THEMES) {
      const tasks = await Database.getAllTasks({ theme, isActive: true });
      expect(tasks.length).toBeGreaterThan(0);
    }
  });

  test('everything is free for now', async () => {
    const free = await Database.getAllTasks({ isActive: true, isFree: true });
    expect(free.length).toBe(ritualsJson.length);
  });

  test('every ritual in the source file is well formed', () => {
    const ids = new Set<string>();
    for (const r of ritualsJson) {
      expect(THEMES).toContain(r.theme);
      expect(r.text.length).toBeGreaterThan(10);
      expect(r.whyItMatters.length).toBeGreaterThan(10);
      expect(['media', 'checkin']).toContain(r.verification);
      if (r.verification === 'media') expect(['photo', 'video', 'audio']).toContain(r.mediaType);
      expect(r.estSeconds).toBeGreaterThanOrEqual(10);
      expect(r.estSeconds).toBeLessThanOrEqual(600);
      expect(ids.has(r.id)).toBe(false);
      ids.add(r.id);
    }
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
    const id = ritualsJson[0].id;
    const before = await Database.getTaskById(id);
    expect(before?.lastShownAt).toBeNull();
    expect(before?.timesShown).toBe(0);

    const now = new Date().toISOString();
    await Database.markTaskShown(id, now);

    const after = await Database.getTaskById(id);
    expect(after?.lastShownAt).toBe(now);
    expect(after?.timesShown).toBe(1);
  });
});
