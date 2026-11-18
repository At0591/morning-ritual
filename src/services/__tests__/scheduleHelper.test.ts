import { describeNextAlarm, getNextAlarmOccurrence, pendingCheckIn } from '../scheduleHelper';
import type { Alarm } from '../../db/database';

const WEEKDAYS = [1, 2, 3, 4, 5];

function alarm(id: string, time: string, days: number[] = [], enabled = true): Alarm {
  return { id, time, days, enabled, soundId: null, smartWakeWindow: 0, createdAt: '', updatedAt: '' };
}

// Tuesday 17 Nov 2026, 15:57 local time.
const tuesdayAfternoon = new Date(2026, 10, 17, 15, 57, 0);

describe('getNextAlarmOccurrence', () => {
  test('no enabled alarms means nothing to schedule', () => {
    expect(getNextAlarmOccurrence([], tuesdayAfternoon)).toBeNull();
    expect(getNextAlarmOccurrence([alarm('a', '07:00', WEEKDAYS, false)], tuesdayAfternoon)).toBeNull();
  });

  test('a time later today rings today', () => {
    const next = getNextAlarmOccurrence([alarm('a', '16:00', WEEKDAYS)], tuesdayAfternoon);
    expect(next?.date).toEqual(new Date(2026, 10, 17, 16, 0));
  });

  test('a time already passed today rings on the next matching day', () => {
    const next = getNextAlarmOccurrence([alarm('a', '07:00', WEEKDAYS)], tuesdayAfternoon);
    expect(next?.date).toEqual(new Date(2026, 10, 18, 7, 0)); // Wednesday
  });

  test('the exact current minute counts as passed', () => {
    const next = getNextAlarmOccurrence([alarm('a', '15:57', WEEKDAYS)], tuesdayAfternoon);
    expect(next?.date).toEqual(new Date(2026, 10, 18, 15, 57));
  });

  test('weekday alarms skip the weekend', () => {
    const fridayEvening = new Date(2026, 10, 20, 21, 0);
    const next = getNextAlarmOccurrence([alarm('a', '07:00', WEEKDAYS)], fridayEvening);
    expect(next?.date).toEqual(new Date(2026, 10, 23, 7, 0)); // Monday
  });

  test('a weekly alarm whose day is today but time has passed rings next week', () => {
    const next = getNextAlarmOccurrence([alarm('a', '07:00', [2])], tuesdayAfternoon);
    expect(next?.date).toEqual(new Date(2026, 10, 24, 7, 0));
  });

  test('one-time alarms ring at the next occurrence of their time', () => {
    const next = getNextAlarmOccurrence([alarm('a', '06:30')], tuesdayAfternoon);
    expect(next?.date).toEqual(new Date(2026, 10, 18, 6, 30));
  });

  test('picks the soonest across several alarms', () => {
    const next = getNextAlarmOccurrence(
      [alarm('weekend', '09:00', [0, 6]), alarm('weekday', '06:30', WEEKDAYS), alarm('off', '05:00', WEEKDAYS, false)],
      tuesdayAfternoon
    );
    expect(next?.alarm.id).toBe('weekday');
  });

  test('crosses month and year boundaries', () => {
    const newYearsEve = new Date(2026, 11, 31, 23, 0);
    const next = getNextAlarmOccurrence([alarm('a', '07:00')], newYearsEve);
    expect(next?.date).toEqual(new Date(2027, 0, 1, 7, 0));
  });
});

describe('describeNextAlarm', () => {
  test('labels today and tomorrow', () => {
    expect(describeNextAlarm(new Date(2026, 10, 17, 18, 0), tuesdayAfternoon)).toMatch(/^Today /);
    expect(describeNextAlarm(new Date(2026, 10, 18, 7, 0), tuesdayAfternoon)).toMatch(/^Tomorrow /);
  });

  test('uses the weekday further out', () => {
    expect(describeNextAlarm(new Date(2026, 10, 20, 7, 0), tuesdayAfternoon)).not.toMatch(/^(Today|Tomorrow)/);
  });
});

describe('pendingCheckIn', () => {
  const now = new Date(2026, 10, 18, 6, 35);

  test('a "Still up?" time still ahead is returned', () => {
    const at = new Date(2026, 10, 18, 6, 41);
    expect(pendingCheckIn(at.toISOString(), now)?.getTime()).toBe(at.getTime());
  });

  test('one that has passed, an empty value or garbage is ignored', () => {
    expect(pendingCheckIn(new Date(2026, 10, 18, 6, 30).toISOString(), now)).toBeNull();
    expect(pendingCheckIn('', now)).toBeNull();
    expect(pendingCheckIn(null, now)).toBeNull();
    expect(pendingCheckIn('not a date', now)).toBeNull();
  });
});