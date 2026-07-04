// src/services/alarm.ts
// Alarm scheduling service — v1.0 final.
//
// Primary mechanism: NATIVE AlarmManager via the local Expo Module at
// `modules/alarm-scheduler/`. This uses `setExactAndAllowWhileIdle()` — the
// Doze-aware API the Google Clock app uses — and survives:
//   - Phone locked
//   - App killed
//   - Device in Doze mode
//   - iQOO / Vivo / Xiaomi aggressive background kill
//
// Secondary mechanism: JS setTimeout + expo-notifications timeInterval, kept
// as a fallback. In practice the native module does all the work on Android;
// the JS path is for iOS and as a defense-in-depth backup on Android.
//
// What the native module does:
//   1. scheduleAlarmNative() → AlarmManager.setExactAndAllowWhileIdle()
//   2. At trigger time → AlarmFireReceiver (in modules/alarm-scheduler)
//   3. Receiver posts high-importance notification with full-screen intent
//      + default alarm sound + writes lastFired to SharedPreferences
//   4. User opens the app → JS calls consumeLastFiredAlarm() and routes to
//      WakeUpScreen
//
// iQOO / Vivo / Xiaomi "Ringstone" toggle is the one thing the user must
// enable manually. The in-app help banner walks them through it.

import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import {
  recordScheduledAlarm,
  markAlarmFired,
  deleteScheduledAlarm,
  clearPendingAlarms,
  getPendingAlarms,
  getMissedAlarms,
  type ScheduledAlarm,
} from '../db/database';
import { AlarmScheduler } from '../../modules/alarm-scheduler/src';
import { getSoundById, DEFAULT_SOUND_ID, SOUND_OPTIONS } from './sounds';
import { getSetting } from '../db/database';
import { trackAlarmFired } from './analytics';

export const ALARM_SOUND_SETTING_KEY = 'alarm_sound_id';
export const PRE_WAKE_WINDOW_SETTING_KEY = 'pre_wake_window_minutes';

const ALARM_CHANNEL_ID = 'morning-ritual-alarm-v2';
const ALARM_CHANNEL_NAME = 'Morning Ritual Alarm';
const ALARM_CATEGORY_ID = 'morning-ritual-alarm';

let initialized = false;
let activeAlarmTimer: ReturnType<typeof setTimeout> | null = null;
let activeAlarmId: string | null = null;
let activeSound: Audio.Sound | null = null;
// Generation counter for in-flight playAlarmSound() calls. See playAlarmSound
// for the race-condition fix.
let soundGeneration = 0;
let onAlarmFireCallback: ((taskId: string, taskText: string) => void) | null = null;

/**
 * Register a callback invoked when an alarm fires. The App uses this to
 * navigate the user to WakeUpScreen so the sound stops on complete.
 */
export function setOnAlarmFireCallback(
  cb: ((taskId: string, taskText: string) => void) | null
): void {
  onAlarmFireCallback = cb;
}

function invokeCallback(taskId: string, taskText: string, source: 'native' | 'js_timer' | 'js_background') {
  trackAlarmFired({ taskId, source });
  if (onAlarmFireCallback) {
    try {
      onAlarmFireCallback(taskId, taskText);
    } catch (e) {
      console.error('onAlarmFireCallback failed:', e);
    }
  }
}

/**
 * Play the alarm sound via expo-av at ALARM volume stream. Race-safe
 * via a generation counter. Reads the user's chosen sound from
 * settings (default: ocean-atlantic). The chosen audio file is one
 * of the bundled MP3s in assets/sounds/tunes/.
 */
export async function playAlarmSound(): Promise<void> {
  if (Platform.OS === 'web') return;
  const myGen = ++soundGeneration;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });

    if (myGen !== soundGeneration) return;

    if (activeSound) {
      try {
        await activeSound.stopAsync();
        await activeSound.unloadAsync();
      } catch {}
      activeSound = null;
    }

    if (myGen !== soundGeneration) return;

    // Read the user's chosen sound from settings
    let soundFile: any = getSoundById(DEFAULT_SOUND_ID).file;
    try {
      const id = await getSetting(ALARM_SOUND_SETTING_KEY);
      if (id) {
        const s = SOUND_OPTIONS.find((o) => o.id === id);
        if (s) soundFile = s.file;
      }
    } catch (e: any) {
      // Fall back to default if DB read fails
    }

    const { sound } = await Audio.Sound.createAsync(soundFile, {
      shouldPlay: true,
      isLooping: true,
      volume: 1.0,
    });

    if (myGen !== soundGeneration) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {}
      return;
    }

    activeSound = sound;
    console.log(`[alarm] playing bundled alarm sound (gen ${myGen})`);
  } catch (e: any) {
    console.error(`[alarm] failed to play alarm sound: ${e?.message ?? e}`);
  }
}

/**
 * Stop the in-app alarm sound. Race-safe: invalidates any in-flight play.
 */
export async function stopAlarmSound(): Promise<void> {
  soundGeneration++;
  if (activeSound) {
    try {
      await activeSound.stopAsync();
      await activeSound.unloadAsync();
    } catch {}
    activeSound = null;
  }
}

/**
 * Set up the alarm service: notification channel (Android), native module
 * listeners, JS notification handler. Safe to call multiple times.
 */
export async function initAlarmService(): Promise<void> {
  if (initialized) return;

  if (Platform.OS === 'android') {
    await cleanupOldChannels();

    try {
      await Notifications.deleteNotificationChannelAsync(ALARM_CHANNEL_ID);
    } catch {}

    // The expo-notifications channel is now a SECONDARY fallback — the
    // primary alarm sound comes from AlarmFireReceiver which posts its
    // own notification. We still keep this channel for the bedtime
    // reminder and any in-app notifications.
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: ALARM_CHANNEL_NAME,
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [300, 250, 300, 250, 300],
      lightColor: '#FF6B35',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      bypassDnd: true,
    });

    try {
      await Notifications.setNotificationCategoryAsync(ALARM_CATEGORY_ID, [
        {
          identifier: 'dismiss',
          buttonTitle: 'Dismiss',
          options: { isDestructive: true },
        },
      ]);
    } catch {}
  }

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data: any = notification.request.content.data;
      if (data?.type === 'alarm') {
        try {
          await playAlarmSound();
        } catch {}
      }
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      };
    },
  });

  // Expo-notifications response listener (fallback for expo-notifications
  // scheduled notifications — the primary path is the native module).
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data: any = response.notification.request.content.data;
    if (data?.type === 'alarm') {
      invokeCallback(data.taskId, data.taskText, 'js_background');
    }
  });

  // Native module warm-start listener: fires when AlarmFireReceiver is
  // invoked and the JS context is alive (app in background but not killed).
  try {
    AlarmScheduler.addAlarmFireListener((event) => {
      console.log(`[alarm] native onAlarmFire (warm): ${event.taskId}`);
      invokeCallback(event.taskId, event.taskText, 'native');
    });
  } catch (e: any) {
    console.warn(`[alarm] failed to attach native alarm listener: ${e?.message ?? e}`);
  }

  initialized = true;
}

/**
 * Cold-start handling: if the alarm fired while the app was killed, the
 * receiver wrote a lastFired entry. The App's bootstrap calls this and
 * navigates to WakeUpScreen if there's a pending fire.
 */
export async function consumeColdStartAlarm(): Promise<
  { taskId: string; taskText: string } | null
> {
  if (Platform.OS !== 'android') return null;
  try {
    const last = await AlarmScheduler.consumeLastFiredAlarm();
    if (last) {
      console.log(`[alarm] cold-start: pending fired alarm ${last.taskId}`);
      // Don't clear here — let the App clear it after the user dismisses.
      return { taskId: last.taskId, taskText: last.taskText };
    }
  } catch (e: any) {
    console.warn(`[alarm] consumeColdStartAlarm failed: ${e?.message ?? e}`);
  }
  return null;
}

export async function clearColdStartAlarm(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await AlarmScheduler.clearLastFiredAlarm();
  } catch {}
}

async function cleanupOldChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const LEGACY_CHANNEL_IDS = ['morning-ritual-alarm'];
  for (const id of LEGACY_CHANNEL_IDS) {
    try {
      await Notifications.deleteNotificationChannelAsync(id);
    } catch {}
  }
}

export async function requestAlarmPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return status === 'granted';
}

/**
 * Schedule a one-time alarm. On Android, this calls the native module
 * (AlarmManager.setExactAndAllowWhileIdle). On iOS / Web, falls back to
 * the JS setTimeout + expo-notifications timeInterval path.
 */
export async function scheduleAlarm(
  fireAt: Date,
  taskId: string,
  taskText: string,
  overridePreWakeWindow?: number
): Promise<string> {
  await initAlarmService();
  const granted = await requestAlarmPermissions();
  if (!granted) {
    throw new Error('Notification permission not granted');
  }

  const delayMs = fireAt.getTime() - Date.now();
  if (delayMs <= 0) {
    throw new Error('Alarm time is in the past. Please pick a time at least 1 minute from now.');
  }

  await cancelActiveAlarmInternal();

  const id = `alarm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const triggerAtMillis = fireAt.getTime();
  console.log(`[alarm] scheduling for ${fireAt.toISOString()} (${Math.round(delayMs / 1000)}s from now), id=${id}`);

  // Persist to SQLite — recovery net for app reload
  try {
    await recordScheduledAlarm({ id, taskId, taskText, fireAt });
    console.log(`[alarm] persisted to SQLite id=${id}`);
  } catch (e: any) {
    console.warn(`[alarm] failed to persist alarm: ${e?.message ?? e}`);
  }

  activeAlarmId = id;

  // ---- Primary: native AlarmManager (Android) ----
  if (Platform.OS === 'android') {
    try {
      let preWakeWindowMinutes = overridePreWakeWindow;
      if (preWakeWindowMinutes === undefined) {
        const windowStr = await getSetting(PRE_WAKE_WINDOW_SETTING_KEY);
        if (windowStr) {
          preWakeWindowMinutes = parseInt(windowStr, 10) || 0;
        } else {
          preWakeWindowMinutes = 0;
        }
      }
      await AlarmScheduler.scheduleAlarm({ taskId: id, taskText, triggerAtMillis, preWakeWindowMinutes });
      console.log(`[alarm] native alarm scheduled id=${id}, preWake=${preWakeWindowMinutes}m`);
    } catch (e: any) {
      console.error(`[alarm] native schedule failed: ${e?.message ?? e}`);
      // Fall through to JS path below
    }
  }

  // ---- Secondary: expo-notifications timeInterval (iOS, or Android fallback) ----
  try {
    const delaySec = Math.max(1, Math.round(delayMs / 1000));
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌅 Morning Ritual — wake up',
        body: taskText.length > 100 ? taskText.slice(0, 97) + '...' : taskText,
        data: { taskId, taskText, type: 'alarm', alarmInternalId: id },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        sticky: false,
        ...(Platform.OS === 'android' && { channelId: ALARM_CHANNEL_ID }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delaySec,
        repeats: false,
        channelId: ALARM_CHANNEL_ID,
      },
    });
  } catch (e: any) {
    console.error(`[alarm] expo-notifications schedule failed: ${e?.message ?? e}`);
  }

  // ---- Tertiary: JS setTimeout (foreground / in-app reliability) ----
  activeAlarmTimer = setTimeout(async () => {
    console.log(`[alarm] JS timer fired (foreground only), id=${id}`);
    activeAlarmTimer = null;
    try {
      await displayAlarmNotification({
        id,
        taskId,
        taskText,
        fireAt: fireAt.toISOString(),
        createdAt: new Date().toISOString(),
        fired: false,
      });
    } catch (e: any) {
      console.error(`[alarm] JS timer notification failed: ${e?.message ?? e}`);
    }
  }, delayMs);

  return id;
}

async function cancelActiveAlarmInternal(): Promise<void> {
  if (activeAlarmTimer) {
    clearTimeout(activeAlarmTimer);
    activeAlarmTimer = null;
  }
  if (activeAlarmId && Platform.OS === 'android') {
    try {
      await AlarmScheduler.cancelAlarm(activeAlarmId);
    } catch {}
  }
  activeAlarmId = null;
}

export async function cancelAlarm(_notificationId: string): Promise<void> {
  await cancelActiveAlarmInternal();
  await stopAlarmSound();
  if (Platform.OS === 'android') {
    try {
      await AlarmScheduler.cancelAllAlarms();
    } catch {}
  }
  if (_notificationId) {
    try {
      await deleteScheduledAlarm(_notificationId);
    } catch {}
  }
}

export async function cancelAllAlarms(): Promise<void> {
  await cancelActiveAlarmInternal();
  await stopAlarmSound();
  if (Platform.OS === 'android') {
    try {
      await AlarmScheduler.cancelAllAlarms();
    } catch {}
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
  await clearPendingAlarms();
}

async function displayAlarmNotification(alarm: ScheduledAlarm): Promise<void> {
  await playAlarmSound();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🌅 Morning Ritual',
      body: alarm.taskText.length > 100
        ? alarm.taskText.slice(0, 97) + '...'
        : alarm.taskText,
      data: { taskId: alarm.taskId, taskText: alarm.taskText, type: 'alarm' },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      ...(Platform.OS === 'android' && { channelId: ALARM_CHANNEL_ID }),
    },
    trigger: null,
  });
  await markAlarmFired(alarm.id);
  invokeCallback(alarm.taskId, alarm.taskText, 'js_timer');
}

/**
 * Recovery net: called on every app start.
 *   1) Fires any missed alarm (fireAt in the past, not yet marked fired)
 *   2) Re-schedules native + JS for any pending alarm (fireAt in the future)
 *   3) Consumes any cold-start alarm (the native module's lastFired entry)
 */
export async function restoreAlarmsOnAppStart(): Promise<{
  missed: number;
  rescheduled: number;
  coldStartFired: boolean;
}> {
  await initAlarmService();

  // 1) Fire any missed alarms
  const missed = await getMissedAlarms();
  for (const alarm of missed) {
    try {
      console.log(`[alarm] firing missed alarm id=${alarm.id}, fireAt=${alarm.fireAt}`);
      await displayAlarmNotification(alarm);
    } catch (e: any) {
      console.error(`[alarm] failed to fire missed alarm: ${e?.message ?? e}`);
    }
  }

  // 2) Re-schedule pending alarms via BOTH native and JS paths
  const pending = await getPendingAlarms();
  let rescheduled = 0;
  for (const alarm of pending) {
    const fireAt = new Date(alarm.fireAt);
    if (fireAt.getTime() <= Date.now()) continue;
    const delayMs = fireAt.getTime() - Date.now();
    const delaySec = Math.max(1, Math.round(delayMs / 1000));
    console.log(`[alarm] rescheduling pending alarm id=${alarm.id}, ${delaySec}s from now`);

    // Native (Android)
    if (Platform.OS === 'android') {
      try {
        let preWakeWindowMinutes = 0;
        const windowStr = await getSetting(PRE_WAKE_WINDOW_SETTING_KEY);
        if (windowStr) {
          preWakeWindowMinutes = parseInt(windowStr, 10) || 0;
        }
        await AlarmScheduler.scheduleAlarm({
          taskId: alarm.id,
          taskText: alarm.taskText,
          triggerAtMillis: fireAt.getTime(),
          preWakeWindowMinutes,
        });
      } catch (e: any) {
        console.error(`[alarm] native reschedule failed: ${e?.message ?? e}`);
      }
    }

    // expo-notifications timeInterval
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌅 Morning Ritual — wake up',
          body: alarm.taskText.length > 100 ? alarm.taskText.slice(0, 97) + '...' : alarm.taskText,
          data: { taskId: alarm.taskId, taskText: alarm.taskText, type: 'alarm' },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          sticky: false,
          ...(Platform.OS === 'android' && { channelId: ALARM_CHANNEL_ID }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delaySec,
          repeats: false,
          channelId: ALARM_CHANNEL_ID,
        },
      });
    } catch (e: any) {
      console.error(`[alarm] expo-notifications reschedule failed: ${e?.message ?? e}`);
    }

    rescheduled++;
  }

  // 3) Cold-start detection — the native module has a lastFired entry
  let coldStartFired = false;
  if (Platform.OS === 'android') {
    try {
      const cold = await AlarmScheduler.consumeLastFiredAlarm();
      if (cold) {
        coldStartFired = true;
        console.log(`[alarm] cold-start fired alarm detected: ${cold.taskId}`);
      }
    } catch (e: any) {
      console.warn(`[alarm] cold-start detection failed: ${e?.message ?? e}`);
    }
  }

  return { missed: missed.length, rescheduled, coldStartFired };
}

export async function getScheduledAlarms(): Promise<{
  identifier: string;
  trigger: string;
  taskText: string;
  fireAt: string;
  fired: boolean;
}[]> {
  const pending = await getPendingAlarms();
  return pending.map((alarm) => ({
    identifier: alarm.id,
    trigger: 'Native AlarmManager + expo-notifications + JS',
    taskText: alarm.taskText.slice(0, 40),
    fireAt: alarm.fireAt,
    fired: alarm.fired,
  }));
}

export async function fireImmediateNotification(): Promise<string> {
  await initAlarmService();
  const granted = await requestAlarmPermissions();
  if (!granted) throw new Error('Notification permission not granted');
  const id = `test-immediate-${Date.now()}`;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔔 Test (immediate)',
      body: 'If you HEAR this, sound + channel work. If silent, check the channel setting.',
      data: { type: 'test_immediate' },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      ...(Platform.OS === 'android' && { channelId: ALARM_CHANNEL_ID }),
    },
    trigger: null,
  });
  return id;
}

export async function fireDelayedNotification(seconds: number): Promise<string> {
  await initAlarmService();
  const granted = await requestAlarmPermissions();
  if (!granted) throw new Error('Notification permission not granted');
  const id = `test-delayed-${Date.now()}`;
  setTimeout(async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Test (delayed)',
          body: `This fired ${seconds}s after you tapped.`,
          data: { type: 'test_delayed' },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          ...(Platform.OS === 'android' && { channelId: ALARM_CHANNEL_ID }),
        },
        trigger: null,
      });
    } catch (e: any) {
      console.error(`[alarm] delayed notification failed: ${e?.message ?? e}`);
    }
  }, seconds * 1000);
  return id;
}

export async function fireAlarmHaptics(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise((r) => setTimeout(r, 200));
  }
}
