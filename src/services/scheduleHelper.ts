import { Alarm } from '../db/database';

export function getNextAlarmOccurrence(alarms: Alarm[]): { alarm: Alarm; date: Date } | null {
  const enabled = alarms.filter(a => a.enabled);
  if (enabled.length === 0) return null;

  const now = new Date();
  
  let closest: { alarm: Alarm; date: Date } | null = null;
  let minDiff = Infinity;

  for (const alarm of enabled) {
    const [hh, mm] = alarm.time.split(':').map(Number);
    const target = new Date(now);
    target.setHours(hh, mm, 0, 0);

    if (alarm.days.length === 0) {
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      const diff = target.getTime() - now.getTime();
      if (diff < minDiff) {
        minDiff = diff;
        closest = { alarm, date: target };
      }
      continue;
    }

    let addDays = 0;
    while (addDays < 8) {
      const d = new Date(target);
      d.setDate(d.getDate() + addDays);
      if (alarm.days.includes(d.getDay())) {
        if (d.getTime() > now.getTime()) {
          const diff = d.getTime() - now.getTime();
          if (diff < minDiff) {
            minDiff = diff;
            closest = { alarm, date: d };
          }
          break;
        }
      }
      addDays++;
    }
  }

  return closest;
}
