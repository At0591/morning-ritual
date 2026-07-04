// src/db/database.ts
// SQLite layer for Morning Ritual.
// Opens DB, runs migrations, seeds from src/data/tasks.json on first launch.

import * as SQLite from 'expo-sqlite';
import tasksJson from '../data/tasks.json';

const DB_NAME = 'morning_ritual.db';
const SCHEMA_VERSION_KEY = 'schema_version';
const CURRENT_SCHEMA_VERSION = '1';

// Schema is loaded as a raw string via require() because Metro can't import .sql directly.
// We use a `?raw` import via expo's assets or a simple fetch.
// Workaround: read from local file. For now, inline the schema as JS string.
import { SCHEMA_SQL } from './schema.inline';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let seededThisSession = false;

/**
 * Open the database, run migrations, seed if first run.
 * Idempotent — safe to call multiple times.
 */
export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;

  const db = await SQLite.openDatabaseAsync(DB_NAME);
  dbInstance = db;

  // Apply schema (idempotent — all CREATE TABLE IF NOT EXISTS)
  await db.execAsync(SCHEMA_SQL);

  // First-run seed
  const currentVersion = await getSetting(SCHEMA_VERSION_KEY);
  if (currentVersion !== CURRENT_SCHEMA_VERSION) {
    await seedTasks(db);
    await setSetting(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION);
    seededThisSession = true;
  }

  return db;
}

/**
 * Get a fresh handle to the open DB. Throws if not opened.
 */
export function getDb(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    throw new Error('Database not opened. Call openDatabase() first.');
  }
  return dbInstance;
}

/**
 * Seed the tasks table from the bundled tasks.json.
 * Idempotent (uses INSERT OR REPLACE) so re-seeding after a content update is safe.
 */
async function seedTasks(db: SQLite.SQLiteDatabase): Promise<void> {
  const tasks = tasksJson as Array<{
    id: string;
    theme: string;
    text: string;
    whyItMatters: string;
    verification: 'media' | 'checkin';
    mediaType?: 'photo' | 'video' | 'audio' | null;
    estSeconds: number;
    isFree: boolean;
  }>;

  for (const t of tasks) {
    await db.runAsync(
      `INSERT OR REPLACE INTO tasks
        (id, theme, text, whyItMatters, verification, mediaType, estSeconds, isFree, isActive, lastShownAt, timesShown)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id,
        t.theme,
        t.text,
        t.whyItMatters,
        t.verification,
        t.mediaType ?? null,
        t.estSeconds,
        t.isFree ? 1 : 0,
        1,    // isActive
        null, // lastShownAt
        0,    // timesShown
      ]
    );
  }
}

/**
 * Was the DB freshly seeded in this session? (Useful for showing a "Welcome" state.)
 */
export function wasSeededThisSession(): boolean {
  return seededThisSession;
}

// --- Query helpers ---

export interface Task {
  id: string;
  theme: string;
  text: string;
  whyItMatters: string;
  verification: 'media' | 'checkin';
  mediaType: 'photo' | 'video' | 'audio' | null;
  estSeconds: number;
  isFree: boolean;
  isActive: boolean;
  lastShownAt: string | null;
  timesShown: number;
}

export async function getAllTasks(filters?: {
  theme?: string;
  isFree?: boolean;
  isActive?: boolean;
}): Promise<Task[]> {
  const db = getDb();
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params: any[] = [];

  if (filters?.theme) {
    sql += ' AND theme = ?';
    params.push(filters.theme);
  }
  if (filters?.isFree !== undefined) {
    sql += ' AND isFree = ?';
    params.push(filters.isFree ? 1 : 0);
  }
  if (filters?.isActive !== undefined) {
    sql += ' AND isActive = ?';
    params.push(filters.isActive ? 1 : 0);
  }

  const rows = await db.getAllAsync(sql, params);
  return rows.map(rowToTask);
}

export async function getTaskById(id: string): Promise<Task | null> {
  const db = getDb();
  const row = await db.getFirstAsync('SELECT * FROM tasks WHERE id = ?', [id]);
  return row ? rowToTask(row) : null;
}

/**
 * Mark a task as just shown: stamp lastShownAt, increment timesShown.
 */
export async function markTaskShown(id: string, timestamp: string): Promise<void> {
  const db = getDb();
  await db.runAsync(
    'UPDATE tasks SET lastShownAt = ?, timesShown = timesShown + 1 WHERE id = ?',
    [timestamp, id]
  );
}

/**
 * Get IDs of tasks shown within the last N days. Used to enforce no-repeat window.
 */
export async function getRecentTaskIds(daysBack: number): Promise<string[]> {
  const db = getDb();
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  const rows = await db.getAllAsync(
    'SELECT id FROM tasks WHERE lastShownAt IS NOT NULL AND lastShownAt > ?',
    [cutoff]
  );
  return rows.map((r: any) => r.id);
}

// --- Alarm history ---

export interface AlarmHistoryEntry {
  id: number;
  taskId: string;
  firedAt: string;
  completedAt: string | null;
  outcome: 'completed' | 'snoozed' | 'skipped' | 'missed';
  verificationData: string | null;
}

export async function recordAlarmFire(
  taskId: string,
  firedAt: string
): Promise<number> {
  const db = getDb();
  const result = await db.runAsync(
    `INSERT INTO alarm_history (taskId, firedAt, outcome) VALUES (?, ?, 'snoozed')`,
    [taskId, firedAt]
  );
  return (result as any).lastInsertRowId ?? 0;
}

export async function recordCompletion(
  historyId: number,
  completedAt: string,
  outcome: 'completed' | 'snoozed' | 'skipped' | 'missed',
  verificationData?: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `UPDATE alarm_history SET completedAt = ?, outcome = ?, verificationData = ? WHERE id = ?`,
    [completedAt, outcome, verificationData ? JSON.stringify(verificationData) : null, historyId]
  );
}

// --- Streaks ---

export interface Streak {
  id: number;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
  totalCompleted: number;
  graceDays: number;
}

export async function getStreak(): Promise<Streak> {
  const db = getDb();
  const row = await db.getFirstAsync('SELECT * FROM streaks WHERE id = 1');
  return row as Streak;
}

export async function updateStreak(updates: Partial<Streak>): Promise<void> {
  const db = getDb();
  const fields = Object.keys(updates);
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => (updates as any)[f]);
  await db.runAsync(`UPDATE streaks SET ${setClause} WHERE id = 1`, values);
}

export interface DayHistory {
  date: string;             // 'YYYY-MM-DD' (local)
  dayOfWeek: number;        // 0 = Sunday, 6 = Saturday
  dayLabel: string;         // 'Mon', 'Tue', etc.
  completed: boolean;       // did the user complete a task on this day
  taskCount: number;        // how many tasks completed on this day
  isToday: boolean;
  isFuture: boolean;
}

/**
 * Get the last N days of completion history. Used for the 7-day streak dot view.
 * Returns oldest-first so the caller can render left-to-right.
 */
export async function getStreakHistory(daysBack: number = 7): Promise<DayHistory[]> {
  const db = getDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: DayHistory[] = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const isToday = i === 0;
    const dow = d.getDay();
    const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow];
    days.push({
      date: dateStr,
      dayOfWeek: dow,
      dayLabel,
      completed: false,
      taskCount: 0,
      isToday,
      isFuture: false,
    });
  }

  // Query completions in the last N days
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - (daysBack - 1));
  const cutoffIso = cutoff.toISOString();

  const rows = await db.getAllAsync(
    `SELECT firedAt, completedAt, outcome FROM alarm_history
     WHERE completedAt IS NOT NULL AND completedAt >= ? AND outcome = 'completed'`,
    [cutoffIso]
  );

  for (const row of rows as any[]) {
    const d = new Date(row.completedAt);
    d.setHours(0, 0, 0, 0);
    const dateStr = d.toISOString().split('T')[0];
    const entry = days.find((day) => day.date === dateStr);
    if (entry) {
      entry.completed = true;
      entry.taskCount += 1;
    }
  }

  return days;
}

// --- Settings (key-value) ---

export async function getSetting(key: string): Promise<string | null> {
  const db = getDb();
  const row = await db.getFirstAsync('SELECT value FROM user_settings WHERE key = ?', [key]);
  return row ? (row as any).value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO user_settings (key, value, updatedAt) VALUES (?, ?, ?)`,
    [key, value, now]
  );
}

// --- Scheduled alarms (persistent queue) ---

/**
 * A scheduled alarm that hasn't fired yet. Persisted to SQLite so it
 * survives JS state resets (Fast Refresh, app reload, low-memory kill).
 */
export type ScheduledAlarm = {
  id: string;
  taskId: string;
  taskText: string;
  fireAt: string; // ISO 8601
  createdAt: string;
  fired: boolean;
};

/**
 * Persist a new alarm to the SQLite queue. The JS setTimeout is the
 * primary mechanism for firing; this table is the recovery net.
 */
export async function recordScheduledAlarm(args: {
  id: string;
  taskId: string;
  taskText: string;
  fireAt: Date;
}): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO scheduled_alarms (id, taskId, taskText, fireAt, createdAt, fired)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [args.id, args.taskId, args.taskText, args.fireAt.toISOString(), now]
  );
}

/**
 * Get all alarms that haven't fired yet, ordered by fire time.
 */
export async function getPendingAlarms(): Promise<ScheduledAlarm[]> {
  const db = getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM scheduled_alarms WHERE fired = 0 ORDER BY fireAt ASC`
  );
  return rows.map((row: any) => ({
    id: row.id,
    taskId: row.taskId,
    taskText: row.taskText,
    fireAt: row.fireAt,
    createdAt: row.createdAt,
    fired: !!row.fired,
  }));
}

/**
 * Get the next alarm that should have fired by now (i.e., its fireAt is
 * in the past) but hasn't been marked fired. Used on app start to fire
 * any alarm we missed because the JS state was reset.
 */
export async function getMissedAlarms(): Promise<ScheduledAlarm[]> {
  const db = getDb();
  const now = new Date().toISOString();
  const rows = await db.getAllAsync(
    `SELECT * FROM scheduled_alarms WHERE fired = 0 AND fireAt <= ? ORDER BY fireAt ASC`,
    [now]
  );
  return rows.map((row: any) => ({
    id: row.id,
    taskId: row.taskId,
    taskText: row.taskText,
    fireAt: row.fireAt,
    createdAt: row.createdAt,
    fired: !!row.fired,
  }));
}

/**
 * Mark an alarm as fired. Called after the JS timer successfully
 * displayed the notification, or when an app-start recovery fires a
 * missed alarm.
 */
export async function markAlarmFired(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `UPDATE scheduled_alarms SET fired = 1 WHERE id = ?`,
    [id]
  );
}

/**
 * Delete a scheduled alarm (used when the user cancels the alarm).
 */
export async function deleteScheduledAlarm(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync(`DELETE FROM scheduled_alarms WHERE id = ?`, [id]);
}

/**
 * Delete ALL pending (unfired) alarms. Used when the user resets all data
 * or the alarm feature is turned off.
 */
export async function clearPendingAlarms(): Promise<void> {
  const db = getDb();
  await db.runAsync(`DELETE FROM scheduled_alarms WHERE fired = 0`, []);
}

// --- Reset ---

/**
 * Wipe all user data (history + streaks + settings) and re-seed tasks.
 * Tasks table is re-seeded with the bundled JSON.
 * Use with care — this is destructive.
 */
export async function resetAllData(): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM alarm_history', []);
  await db.runAsync('DELETE FROM streaks', []);
  await db.runAsync('DELETE FROM habit_chains', []);
  await db.runAsync('DELETE FROM user_settings', []);
  await db.runAsync('DELETE FROM scheduled_alarms', []);
  await db.runAsync('DELETE FROM alarms', []);
  // Re-seed streak row
  await db.runAsync(
    `INSERT INTO streaks (id, currentStreak, longestStreak, lastCompletedDate, totalCompleted, graceDays)
     VALUES (1, 0, 0, NULL, 0, 0)`,
    []
  );
  // Re-seed habit chains
  const themes = ['body', 'mind', 'brain', 'creative'];
  for (const t of themes) {
    await db.runAsync(
      `INSERT INTO habit_chains (theme, chainCount, longestChain, earnedBadge) VALUES (?, 0, 0, 0)`,
      [t]
    );
  }
  // Re-seed tasks (in case the bundled JSON has changed)
  const tasks = tasksJson as Array<{
    id: string;
    theme: string;
    text: string;
    whyItMatters: string;
    verification: 'media' | 'checkin';
    mediaType?: 'photo' | 'video' | 'audio' | null;
    estSeconds: number;
    isFree: boolean;
  }>;
  await db.runAsync('DELETE FROM tasks', []);
  for (const t of tasks) {
    await db.runAsync(
      `INSERT INTO tasks
        (id, theme, text, whyItMatters, verification, mediaType, estSeconds, isFree, isActive, lastShownAt, timesShown)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id,
        t.theme,
        t.text,
        t.whyItMatters,
        t.verification,
        t.mediaType ?? null,
        t.estSeconds,
        t.isFree ? 1 : 0,
        1, null, 0,
      ]
    );
  }
  // Mark schema as current so seedTasks doesn't run again
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO user_settings (key, value, updatedAt) VALUES ('schema_version', '1', ?)`,
    [now]
  );
}

// --- History ---

// --- Habit chains ---

export interface HabitChain {
  theme: string;
  chainCount: number;       // current consecutive days in this theme
  lastChainDate: string | null;
  longestChain: number;
  completedAt: string | null;
  earnedBadge: boolean;
}

/**
 * Update the habit chain for a given theme after a task completion.
 * Returns the new chain state, plus a flag for whether the chain just completed (hit 7).
 */
export async function updateHabitChain(
  theme: string,
  completionDate: Date = new Date()
): Promise<{ chain: HabitChain; justCompleted: boolean; alreadyCompleted: boolean }> {
  const db = getDb();
  const today = completionDate.toISOString().split('T')[0];
  const yesterday = new Date(completionDate.getTime() - 86400_000).toISOString().split('T')[0];

  const row = await db.getFirstAsync('SELECT * FROM habit_chains WHERE theme = ?', [theme]);
  if (!row) {
    throw new Error(`Unknown theme for habit chain: ${theme}`);
  }
  const current = rowToChain(row);

  // If the user already counted today for this theme, no change
  if (current.lastChainDate === today) {
    return { chain: current, justCompleted: false, alreadyCompleted: true };
  }

  // If yesterday → continue chain
  // Otherwise → reset to 1
  const newCount = current.lastChainDate === yesterday ? current.chainCount + 1 : 1;
  const justCompleted = newCount >= 7 && !current.earnedBadge;
  const newLongest = Math.max(current.longestChain, newCount);
  const completedAt = justCompleted ? completionDate.toISOString() : current.completedAt;
  const earnedBadge = justCompleted || current.earnedBadge;

  await db.runAsync(
    `UPDATE habit_chains SET chainCount = ?, lastChainDate = ?, longestChain = ?, completedAt = ?, earnedBadge = ? WHERE theme = ?`,
    [newCount, today, newLongest, completedAt, earnedBadge ? 1 : 0, theme]
  );

  return {
    chain: {
      theme,
      chainCount: newCount,
      lastChainDate: today,
      longestChain: newLongest,
      completedAt,
      earnedBadge,
    },
    justCompleted,
    alreadyCompleted: false,
  };
}

export async function getAllChains(): Promise<HabitChain[]> {
  const db = getDb();
  const rows = await db.getAllAsync('SELECT * FROM habit_chains');
  return rows.map(rowToChain);
}

export async function getChain(theme: string): Promise<HabitChain | null> {
  const db = getDb();
  const row = await db.getFirstAsync('SELECT * FROM habit_chains WHERE theme = ?', [theme]);
  return row ? rowToChain(row) : null;
}

function rowToChain(row: any): HabitChain {
  return {
    theme: row.theme,
    chainCount: row.chainCount,
    lastChainDate: row.lastChainDate,
    longestChain: row.longestChain,
    completedAt: row.completedAt,
    earnedBadge: !!row.earnedBadge,
  };
}

export interface HistoryEntry {
  id: number;
  taskId: string;
  task: Task | null;       // joined from tasks table
  firedAt: string;
  completedAt: string | null;
  outcome: 'completed' | 'snoozed' | 'skipped' | 'missed';
  verificationData: any;
}

/**
 * Get the last N history entries (most recent first). Joins with tasks for display.
 */
export async function getHistory(limit: number = 50): Promise<HistoryEntry[]> {
  const db = getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM alarm_history ORDER BY firedAt DESC LIMIT ?`,
    [limit]
  );
  const entries: HistoryEntry[] = [];
  for (const r of rows as any[]) {
    const task = await getTaskById(r.taskId);
    let verificationData = null;
    if (r.verificationData) {
      try { verificationData = JSON.parse(r.verificationData); } catch {}
    }
    entries.push({
      id: r.id,
      taskId: r.taskId,
      task,
      firedAt: r.firedAt,
      completedAt: r.completedAt,
      outcome: r.outcome,
      verificationData,
    });
  }
  return entries;
}

// --- Helpers ---

function rowToTask(row: any): Task {
  return {
    id: row.id,
    theme: row.theme,
    text: row.text,
    whyItMatters: row.whyItMatters,
    verification: row.verification,
    mediaType: row.mediaType,
    estSeconds: row.estSeconds,
    isFree: !!row.isFree,
    isActive: !!row.isActive,
    lastShownAt: row.lastShownAt,
    timesShown: row.timesShown,
  };
}

// --- Alarms (User-configured) ---

export interface Alarm {
  id: string;
  time: string;           // 'HH:MM'
  days: number[];         // [0-6]
  enabled: boolean;
  soundId: string | null;
  smartWakeWindow: number;
  createdAt: string;
  updatedAt: string;
}

export async function getAllAlarms(): Promise<Alarm[]> {
  const db = getDb();
  const rows = await db.getAllAsync('SELECT * FROM alarms ORDER BY time ASC');
  return rows.map((row: any) => ({
    id: row.id,
    time: row.time,
    days: JSON.parse(row.days),
    enabled: !!row.enabled,
    soundId: row.soundId,
    smartWakeWindow: row.smartWakeWindow,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function addAlarm(alarm: Omit<Alarm, 'createdAt' | 'updatedAt'>): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO alarms (id, time, days, enabled, soundId, smartWakeWindow, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      alarm.id,
      alarm.time,
      JSON.stringify(alarm.days),
      alarm.enabled ? 1 : 0,
      alarm.soundId,
      alarm.smartWakeWindow,
      now,
      now,
    ]
  );
}

export async function updateAlarm(id: string, updates: Partial<Omit<Alarm, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  
  const fields = Object.keys(updates);
  if (fields.length === 0) return;
  
  const setClauses = fields.map(f => {
    if (f === 'enabled') return 'enabled = ?';
    if (f === 'days') return 'days = ?';
    return `${f} = ?`;
  });
  setClauses.push('updatedAt = ?');
  
  const values = fields.map(f => {
    const val = (updates as any)[f];
    if (f === 'enabled') return val ? 1 : 0;
    if (f === 'days') return JSON.stringify(val);
    return val;
  });
  values.push(now, id);
  
  await db.runAsync(
    `UPDATE alarms SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteAlarm(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM alarms WHERE id = ?', [id]);
}

