// src/services/alarmSync.ts
// Keeps the OS-level alarm in step with the alarms the user has switched on.
//
// Before this existed, saving or enabling an alarm only wrote to SQLite; the
// OS alarm was scheduled only from a separate "Set" button on the home screen,
// so most alarms never rang. Call syncAlarms() whenever alarms change, when the
// app starts, and after each morning flow, and the next ring is always queued.

import * as Notifications from 'expo-notifications';
import { getAllAlarms } from '../db/database';
import { clearScheduledAlarms, rebookPendingCheckIn, scheduleAlarm } from './alarm';
import { getNextAlarmOccurrence, type NextAlarm } from './scheduleHelper';

export type AlarmSyncResult =
  | { status: 'scheduled'; next: NextAlarm }
  | { status: 'none' }
  | { status: 'needs-permission'; next: NextAlarm }
  | { status: 'error'; next: NextAlarm; message: string };

export interface RitualForAlarm {
  id: string;
  text: string;
}

let inFlight: Promise<AlarmSyncResult> | null = null;

/**
 * Schedule the soonest enabled alarm with the OS (or cancel everything if no
 * alarm is enabled). `askPermission` should be true only when the user has
 * just acted (saved an alarm, finished onboarding, tapped "Allow"), so the
 * permission prompt appears in context and isn't burned on app start.
 */
export function syncAlarms(
  ritual: RitualForAlarm,
  options: { askPermission?: boolean } = {}
): Promise<AlarmSyncResult> {
  // Serialise calls: overlapping schedules could cancel each other.
  const run = async (): Promise<AlarmSyncResult> => {
    const next = getNextAlarmOccurrence(await getAllAlarms());
    if (!next) {
      // Leaves a currently ringing alarm alone; only future alarms are removed.
      await clearScheduledAlarms();
      // Clearing removes a pending "Still up?" too; put it back if it's still due.
      await rebookPendingCheckIn();
      return { status: 'none' };
    }

    if (!options.askPermission) {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return { status: 'needs-permission', next };
    }

    try {
      // Exactly one alarm queued at a time, whatever was scheduled before.
      await clearScheduledAlarms();
      await scheduleAlarm(next.date, ritual.id, ritual.text, next.alarm.smartWakeWindow);
      await rebookPendingCheckIn();
      return { status: 'scheduled', next };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (/permission/i.test(message)) return { status: 'needs-permission', next };
      return { status: 'error', next, message };
    }
  };

  const queued = (inFlight ?? Promise.resolve(null)).catch(() => null).then(run);
  inFlight = queued;
  return queued;
}
