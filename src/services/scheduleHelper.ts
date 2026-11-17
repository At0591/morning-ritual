import type { Alarm } from '../db/database';

export interface NextAlarm {
  alarm: Alarm;
  date: Date;
}

/**
 * The soonest future ring time across all enabled alarms.
 * `days` uses JS weekday numbers (0 = Sunday). An empty `days` list is a
 * one-time alarm: it rings at the next occurrence of its time.
 * `now` is injectable so the logic can be tested against a fixed clock.
 */
export function getNextAlarmOccurrence(alarms: Alarm[], now: Date = new Date()): NextAlarm | null {
  let closest: NextAlarm | null = null;

  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    const [hh, mm] = alarm.time.split(':').map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) continue;

    // Look at today and the next 7 days; the first match is this alarm's next ring.
    for (let addDays = 0; addDays <= 7; addDays++) {
      const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + addDays, hh, mm, 0, 0);
      if (candidate.getTime() <= now.getTime()) continue;
      if (alarm.days.length > 0 && !alarm.days.includes(candidate.getDay())) continue;
      if (!closest || candidate.getTime() < closest.date.getTime()) {
        closest = { alarm, date: candidate };
      }
      break;
    }
  }

  return closest;
}

/** Friendly label for the home screen, e.g. "Today 7:00 AM" or "Wed 6:30 AM". */
export function describeNextAlarm(date: Date, now: Date = new Date()): string {
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (dayDiff === 0) return `Today ${time}`;
  if (dayDiff === 1) return `Tomorrow ${time}`;
  const weekday = date.toLocaleDateString([], { weekday: 'short' });
  return `${weekday} ${time}`;
}
