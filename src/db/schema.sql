-- Morning Ritual — SQLite schema
-- Version 1.1.0
--
-- 5 tables:
--   1. tasks            — bundled 1000 tasks (seeded from src/data/tasks.json)
--   2. alarm_history    — log of alarm fires (which task, completed/skipped, time)
--   3. streaks          — daily streak counter (current, longest, last_completed_date)
--   4. user_settings    — key-value (alarm_time, theme, tier, etc.)
--   5. alarms           — multiple user-configured alarms
--
-- All timestamps stored as ISO 8601 strings (TEXT) for human-readable debugging.
-- Dates for streak calculations stored as 'YYYY-MM-DD' strings.

PRAGMA foreign_keys = ON;

-- 1. tasks
--   isFree=1 → free-tier (every user can see)
--   isFree=0 → premium-tier (subscription required to unlock)
--   isActive=1 → eligible for daily pick; 0 = soft-deleted (future use)
--   lastShownAt IS NULL → never shown; else timestamp of last reveal
--   timesShown: lifetime count, used as a tie-breaker in weighted random
CREATE TABLE IF NOT EXISTS tasks (
  id              TEXT PRIMARY KEY,         -- e.g., 'body-001'
  theme           TEXT NOT NULL,            -- 'body' | 'mind' | 'brain' | 'creative'
  text            TEXT NOT NULL,            -- the actual task (1-2 sentences)
  whyItMatters    TEXT NOT NULL,            -- footnote (research citation or "research shows...")
  verification    TEXT NOT NULL,            -- 'media' | 'checkin'
  mediaType       TEXT,                     -- 'photo' | 'video' | 'audio' (NULL for checkin)
  estSeconds      INTEGER NOT NULL DEFAULT 30,
  isFree          INTEGER NOT NULL DEFAULT 0,  -- 0 = premium, 1 = free
  isActive        INTEGER NOT NULL DEFAULT 1,  -- 0 = soft-deleted
  lastShownAt     TEXT,                     -- ISO 8601 timestamp
  timesShown      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tasks_theme ON tasks(theme);
CREATE INDEX IF NOT EXISTS idx_tasks_tier ON tasks(isFree);
CREATE INDEX IF NOT EXISTS idx_tasks_lastShown ON tasks(lastShownAt);

-- 2. alarm_history
--   taskId FK to tasks.id (soft FK — tasks can be removed without cascading)
--   firedAt: ISO 8601
--   outcome: 'completed' | 'snoozed' | 'skipped' | 'missed'
CREATE TABLE IF NOT EXISTS alarm_history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  taskId          TEXT NOT NULL,
  firedAt         TEXT NOT NULL,
  completedAt     TEXT,
  outcome         TEXT NOT NULL,            -- 'completed' | 'snoozed' | 'skipped' | 'missed'
  verificationData TEXT                     -- JSON: { kind, ... } — photo path, voice path, checkin values
);

CREATE INDEX IF NOT EXISTS idx_history_task ON alarm_history(taskId);
CREATE INDEX IF NOT EXISTS idx_history_firedAt ON alarm_history(firedAt);

-- 3. streaks
--   Single row (id=1) for now. Multi-streak (per theme, per tier) comes in v1.1.
--   lastCompletedDate stored as 'YYYY-MM-DD' (local date)
--   graceDays: number of allowed skip days before streak breaks (default 0, hard mode)
CREATE TABLE IF NOT EXISTS streaks (
  id                  INTEGER PRIMARY KEY DEFAULT 1,
  currentStreak       INTEGER NOT NULL DEFAULT 0,
  longestStreak       INTEGER NOT NULL DEFAULT 0,
  lastCompletedDate   TEXT,                 -- 'YYYY-MM-DD' (local)
  totalCompleted      INTEGER NOT NULL DEFAULT 0,
  graceDays           INTEGER NOT NULL DEFAULT 0
);

-- Seed the single streak row on first run (idempotent)
INSERT OR IGNORE INTO streaks (id, currentStreak, longestStreak, lastCompletedDate, totalCompleted, graceDays)
  VALUES (1, 0, 0, NULL, 0, 0);

-- 3b. habit_chains
--   7-day same-theme streaks. Each theme has its own chain.
--   chainCount: how many consecutive days in this theme (resets on miss)
--   lastChainDate: date of the last chain-incrementing completion
--   completedAt: timestamp when the chain reached 7 (NULL = not yet)
--   earnedBadge: 1 if user earned the [Theme] Champion badge
CREATE TABLE IF NOT EXISTS habit_chains (
  theme            TEXT PRIMARY KEY,
  chainCount       INTEGER NOT NULL DEFAULT 0,
  lastChainDate    TEXT,
  longestChain     INTEGER NOT NULL DEFAULT 0,
  completedAt      TEXT,
  earnedBadge      INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO habit_chains (theme, chainCount, longestChain, earnedBadge) VALUES ('body', 0, 0, 0);
INSERT OR IGNORE INTO habit_chains (theme, chainCount, longestChain, earnedBadge) VALUES ('mind', 0, 0, 0);
INSERT OR IGNORE INTO habit_chains (theme, chainCount, longestChain, earnedBadge) VALUES ('brain', 0, 0, 0);
INSERT OR IGNORE INTO habit_chains (theme, chainCount, longestChain, earnedBadge) VALUES ('creative', 0, 0, 0);

-- 4. user_settings
--   Generic key-value store. Schema-less on purpose for flexibility.
--   Keys: alarm_time (HH:MM), theme (body|mind|brain|creative), tier (free|premium|trial),
--         trial_started_at, trial_ends_at, onboarding_complete, sound_enabled, etc.
CREATE TABLE IF NOT EXISTS user_settings (
  key             TEXT PRIMARY KEY,
  value           TEXT NOT NULL,
  updatedAt       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_settings_updated ON user_settings(updatedAt);

-- 5. alarms
--   Multiple alarms per user (e.g., Weekdays vs Weekends).
--   days: JSON array of 0-6 (Sunday-Saturday), e.g., '[1,2,3,4,5]'. Null/empty means one-shot alarm.
--   time: 'HH:MM' string in local time.
CREATE TABLE IF NOT EXISTS alarms (
  id              TEXT PRIMARY KEY,
  time            TEXT NOT NULL,
  days            TEXT NOT NULL,            -- JSON array
  enabled         INTEGER NOT NULL DEFAULT 1,
  soundId         TEXT,                     -- Override default sound (null = use default)
  smartWakeWindow INTEGER NOT NULL DEFAULT 0, -- Override default window (0 = off)
  createdAt       TEXT NOT NULL,
  updatedAt       TEXT NOT NULL
);
