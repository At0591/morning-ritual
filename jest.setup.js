// Jest setup — mock native modules that don't run in Node test env.

// Mock expo-sqlite with an in-memory implementation.
jest.mock('expo-sqlite', () => {
  const tables = new Map();

  function getTable(name) {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name);
  }

  // Parse "WHERE col = ?" with optional AND-joined clauses
  function whereMatches(row, sql, params) {
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s*$)/i);
    if (!whereMatch) return true;
    const conditions = whereMatch[1].split(/\s+AND\s+/i);
    let paramIdx = 0;
    for (const cond of conditions) {
      const eqMatch = cond.match(/(\w+)\s*=\s*\?/);
      if (eqMatch) {
        const col = eqMatch[1];
        const val = params[paramIdx++];
        if (row[col] !== val) return false;
      }
    }
    return true;
  }

  function getMatchingRows(sql, params) {
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (!tableMatch) return [];
    const table = getTable(tableMatch[1]);
    return table.filter((row) => whereMatches(row, sql, params));
  }

  return {
    openDatabaseAsync: jest.fn(async (name) => ({
      _name: name,
      execAsync: jest.fn(async (sql) => {
        // Run all statements in the SQL block
        const statements = sql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        for (const stmt of statements) {
          if (/CREATE TABLE/i.test(stmt)) {
            const match = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
            if (match) getTable(match[1]);
          } else if (/INSERT OR IGNORE/i.test(stmt)) {
            // Seed row: INSERT OR IGNORE INTO streaks (id, ...) VALUES (1, ...)
            const m = stmt.match(/INSERT OR IGNORE INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
            if (m) {
              const tableName = m[1];
              const cols = m[2].split(',').map((c) => c.trim());
              const values = m[3].split(',').map((v) => v.trim().toUpperCase() === 'NULL' ? null : v.trim());
              const table = getTable(tableName);
              const row = {};
              cols.forEach((col, i) => {
                const v = values[i];
                row[col] = v === null ? null : (isNaN(Number(v)) ? v : Number(v));
              });
              // Idempotent: only push if no row with same primary key
              const pk = cols[0];
              if (!table.find((r) => r[pk] === row[pk])) table.push(row);
            }
          } else if (/INSERT/i.test(stmt)) {
            // Handled below in runAsync; ignore here
          }
        }
      }),
      runAsync: jest.fn(async (sql, params = []) => {
        const insertMatch = sql.match(/INSERT (?:OR REPLACE )?INTO (\w+)\s*\(([^)]+)\)/i);
        if (insertMatch) {
          const tableName = insertMatch[1];
          const cols = insertMatch[2].split(',').map((c) => c.trim());
          const table = getTable(tableName);
          const row = {};
          cols.forEach((col, i) => { row[col] = params[i]; });
          // For INSERT OR REPLACE on a primary key conflict, replace
          if (/OR REPLACE/i.test(sql)) {
            const pk = cols[0];
            const existingIdx = table.findIndex((r) => r[pk] === row[pk]);
            if (existingIdx >= 0) table[existingIdx] = row;
            else table.push(row);
          } else {
            table.push(row);
          }
        } else if (/UPDATE/i.test(sql)) {
          const updateMatch = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+?)(?:\s*$)/i);
          if (updateMatch) {
            const tableName = updateMatch[1];
            const setClause = updateMatch[2];
            const table = getTable(tableName);
            // Parse "col1 = ?, col2 = col2 + ?" — handle both ? and inline math
            const sets = setClause.split(',').map((s) => s.trim());
            const setMap = {};
            let paramIdx = 0;
            for (const s of sets) {
              const m = s.match(/(\w+)\s*=\s*(.+)/);
              if (!m) continue;
              const col = m[1];
              const expr = m[2].trim();
              if (expr === '?') {
                setMap[col] = { type: 'param', idx: paramIdx++ };
              } else {
                // "col + ?" pattern
                const addParamMatch = expr.match(/^(\w+)\s*\+\s*\?$/);
                if (addParamMatch) {
                  setMap[col] = { type: 'add_param', base: addParamMatch[1], idx: paramIdx++ };
                } else {
                  // "col + N" pattern (literal increment)
                  const addLitMatch = expr.match(/^(\w+)\s*\+\s*(\d+)$/);
                  if (addLitMatch) {
                    setMap[col] = { type: 'add_lit', base: addLitMatch[1], value: Number(addLitMatch[2]) };
                  } else {
                    // Pure literal
                    const numMatch = expr.match(/^-?\d+$/);
                    if (numMatch) setMap[col] = { type: 'literal', value: Number(expr) };
                    // Otherwise ignore (string literal or complex expr)
                  }
                }
              }
            }
            // For our tests, we don't need to filter by WHERE — just update all
            for (const row of table) {
              for (const col in setMap) {
                const op = setMap[col];
                if (op.type === 'param') row[col] = params[op.idx];
                else if (op.type === 'add_param') row[col] = (row[op.base] ?? 0) + (Number(params[op.idx]) || 0);
                else if (op.type === 'add_lit') row[col] = (row[op.base] ?? 0) + op.value;
                else if (op.type === 'literal') row[col] = op.value;
              }
            }
          }
        }
        return { lastInsertRowId: 1, changes: 1 };
      }),
      getAllAsync: jest.fn(async (sql, params = []) => {
        return getMatchingRows(sql, params);
      }),
      getFirstAsync: jest.fn(async (sql, params = []) => {
        const rows = getMatchingRows(sql, params);
        return rows[0] || null;
      }),
      closeAsync: jest.fn(async () => {}),
    })),
  };
});

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(async () => 'mock-notification-id'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  SchedulableTriggerInputTypes: { DATE_TIME: 'dateTime' },
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Heavy: 'heavy', Medium: 'medium', Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  isDevice: true,
  osName: 'Android',
  osVersion: '13',
}));
