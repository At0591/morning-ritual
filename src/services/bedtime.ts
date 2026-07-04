// src/services/bedtime.ts
// Bedtime reminder service. Schedules a gentle notification 30 min before
// the user's preferred bedtime. Uses a JS setTimeout + expo-notifications
// (same pattern as the morning alarm) for foreground reliability.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const BEDTIME_CHANNEL_ID = 'morning-ritual-bedtime-v2';
const BEDTIME_CHANNEL_NAME = 'Bedtime Reminder';
const REMINDER_OFFSET_MIN = 30;

let initialized = false;
let activeTimer: ReturnType<typeof setTimeout> | null = null;
let activeId: string | null = null;

async function ensureBedtimeChannel() {
  if (initialized) return;
  if (Platform.OS === 'android') {
    // Clean up old v1 channel
    try {
      await Notifications.deleteNotificationChannelAsync('morning-ritual-bedtime');
    } catch {}
    try {
      await Notifications.deleteNotificationChannelAsync(BEDTIME_CHANNEL_ID);
    } catch {}
    await Notifications.setNotificationChannelAsync(BEDTIME_CHANNEL_ID, {
      name: BEDTIME_CHANNEL_NAME,
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200, 200, 200],
      lightColor: '#AB47BC',
      sound: 'default',
      enableVibrate: true,
      showBadge: false,
    });
  }
  initialized = true;
}

/**
 * Schedule a bedtime reminder for tonight (or tomorrow if past).
 * @param bedtime "HH:MM" — the time the user wants to be asleep by
 * @returns the scheduled notification ID, or null if reminder time has passed
 */
export async function scheduleBedtimeReminder(bedtime: string): Promise<string | null> {
  await ensureBedtimeChannel();
  const m = /^(\d{1,2}):(\d{2})$/.exec(bedtime.trim());
  if (!m) throw new Error('Invalid bedtime format. Use HH:MM.');

  const hour = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const minute = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  const now = new Date();
  const reminder = new Date(now);
  reminder.setHours(hour, minute, 0, 0);
  reminder.setMinutes(reminder.getMinutes() - REMINDER_OFFSET_MIN);
  if (reminder.getTime() <= now.getTime()) {
    reminder.setDate(reminder.getDate() + 1);
  }

  const delayMs = reminder.getTime() - now.getTime();
  if (delayMs <= 0) return null;

  // Cancel any existing reminder
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }

  const id = `bedtime-${Date.now()}`;
  console.log(`[bedtime] scheduling JS timer for ${reminder.toISOString()} (${Math.round(delayMs/1000)}s from now), id=${id}`);

  activeId = id;
  activeTimer = setTimeout(async () => {
    activeTimer = null;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌙 Wind down',
          body: `Bedtime in 30 minutes. Start your wind-down ritual.`,
          data: { type: 'bedtime' },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
          ...(Platform.OS === 'android' && { channelId: BEDTIME_CHANNEL_ID }),
        },
        trigger: null,
      });
    } catch (e: any) {
      console.error(`[bedtime] notification failed: ${e?.message ?? e}`);
    }
  }, delayMs);

  return id;
}

export async function cancelBedtimeReminder(): Promise<void> {
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
  if (activeId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(activeId);
    } catch {}
    activeId = null;
  }
}
