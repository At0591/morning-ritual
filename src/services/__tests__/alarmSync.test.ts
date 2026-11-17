import type { Alarm } from '../../db/database';

const mockAlarms: Alarm[] = [];
const mockCalls: string[] = [];
let mockPermission = 'granted';
let mockScheduleError: Error | null = null;

jest.mock('../../db/database', () => ({
  getAllAlarms: jest.fn(async () => mockAlarms),
}));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: mockPermission })),
}));
jest.mock('../alarm', () => ({
  clearScheduledAlarms: jest.fn(async () => {
    mockCalls.push('clear');
  }),
  scheduleAlarm: jest.fn(async (date: Date) => {
    if (mockScheduleError) throw mockScheduleError;
    mockCalls.push(`schedule ${date.getHours()}:${date.getMinutes()}`);
    return 'id';
  }),
}));

import { syncAlarms } from '../alarmSync';

const ritual = { id: 'body-001', text: 'Drink a glass of water' };
const everyDay = (time: string, enabled = true): Alarm => ({
  id: time, time, days: [0, 1, 2, 3, 4, 5, 6], enabled, soundId: null, smartWakeWindow: 0, createdAt: '', updatedAt: '',
});

beforeEach(() => {
  mockAlarms.length = 0;
  mockCalls.length = 0;
  mockPermission = 'granted';
  mockScheduleError = null;
});

test('no enabled alarm clears anything queued and reports none', async () => {
  mockAlarms.push(everyDay('07:00', false));
  await expect(syncAlarms(ritual)).resolves.toEqual({ status: 'none' });
  expect(mockCalls).toEqual(['clear']);
});

test('clears old alarms before scheduling the next one, so only one is ever queued', async () => {
  mockAlarms.push(everyDay('07:00'));
  const result = await syncAlarms(ritual);
  expect(result.status).toBe('scheduled');
  expect(mockCalls).toEqual(['clear', 'schedule 7:0']);
});

test('without permission it reports needs-permission and does not prompt or schedule', async () => {
  mockPermission = 'denied';
  mockAlarms.push(everyDay('07:00'));
  const result = await syncAlarms(ritual);
  expect(result.status).toBe('needs-permission');
  expect(mockCalls).toEqual([]);
});

test('a permission error while scheduling is reported as needs-permission', async () => {
  mockScheduleError = new Error('Notification permission not granted');
  mockAlarms.push(everyDay('07:00'));
  await expect(syncAlarms(ritual, { askPermission: true })).resolves.toMatchObject({ status: 'needs-permission' });
});

test('other scheduling failures are reported, not thrown', async () => {
  mockScheduleError = new Error('Exact alarm permission not granted. Open Settings');
  mockAlarms.push(everyDay('07:00'));
  // "permission" in the text is treated as a permission problem the user can fix.
  await expect(syncAlarms(ritual, { askPermission: true })).resolves.toMatchObject({ status: 'needs-permission' });
  mockScheduleError = new Error('native module unavailable');
  await expect(syncAlarms(ritual, { askPermission: true })).resolves.toMatchObject({ status: 'error' });
});

test('overlapping calls run one after another', async () => {
  mockAlarms.push(everyDay('07:00'));
  await Promise.all([syncAlarms(ritual), syncAlarms(ritual)]);
  expect(mockCalls).toEqual(['clear', 'schedule 7:0', 'clear', 'schedule 7:0']);
});
