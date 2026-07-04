// src/db/schema.inline.ts
// Schema SQL as a TS string literal. Inlined for Metro compatibility
// (Metro doesn't support raw .sql imports without extra config).
//
// Source: src/db/schema.sql — keep these in sync.

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tasks (
  id              TEXT PRIMARY KEY,
  theme           TEXT NOT NULL,
  text            TEXT NOT NULL,
  whyItMatters    TEXT NOT NULL,
  verification    TEXT NOT NULL,
  mediaType       TEXT,
  estSeconds      INTEGER NOT NULL DEFAULT 30,
  isFree          INTEGER NOT NULL DEFAULT 0,
  isActive        INTEGER NOT NULL DEFAULT 1,
  lastShownAt     TEXT,
  timesShown      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tasks_theme ON tasks(theme);
CREATE INDEX IF NOT EXISTS idx_tasks_tier ON tasks(isFree);
CREATE INDEX IF NOT EXISTS idx_tasks_lastShown ON tasks(lastShownAt);

CREATE TABLE IF NOT EXISTS alarm_history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  taskId          TEXT NOT NULL,
  firedAt         TEXT NOT NULL,
  completedAt     TEXT,
  outcome         TEXT NOT NULL,
  verificationData TEXT
);

CREATE INDEX IF NOT EXISTS idx_history_task ON alarm_history(taskId);
CREATE INDEX IF NOT EXISTS idx_history_firedAt ON alarm_history(firedAt);

CREATE TABLE IF NOT EXISTS streaks (
  id                  INTEGER PRIMARY KEY DEFAULT 1,
  currentStreak       INTEGER NOT NULL DEFAULT 0,
  longestStreak       INTEGER NOT NULL DEFAULT 0,
  lastCompletedDate   TEXT,
  totalCompleted      INTEGER NOT NULL DEFAULT 0,
  graceDays           INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO streaks (id, currentStreak, longestStreak, lastCompletedDate, totalCompleted, graceDays)
  VALUES (1, 0, 0, NULL, 0, 0);

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

CREATE TABLE IF NOT EXISTS user_settings (
  key             TEXT PRIMARY KEY,
  value           TEXT NOT NULL,
  updatedAt       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_settings_updated ON user_settings(updatedAt);

CREATE TABLE IF NOT EXISTS scheduled_alarms (
  id              TEXT PRIMARY KEY,
  taskId          TEXT NOT NULL,
  taskText        TEXT NOT NULL,
  fireAt          TEXT NOT NULL,
  createdAt       TEXT NOT NULL,
  fired           INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_scheduled_fireAt ON scheduled_alarms(fireAt);
CREATE INDEX IF NOT EXISTS idx_scheduled_fired ON scheduled_alarms(fired);

CREATE TABLE IF NOT EXISTS alarms (
  id              TEXT PRIMARY KEY,
  time            TEXT NOT NULL,
  days            TEXT NOT NULL,
  enabled         INTEGER NOT NULL DEFAULT 1,
  soundId         TEXT,
  smartWakeWindow INTEGER NOT NULL DEFAULT 0,
  createdAt       TEXT NOT NULL,
  updatedAt       TEXT NOT NULL
);
`;
