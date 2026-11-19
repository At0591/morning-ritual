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
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Asset } from 'expo-asset';
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
import { getSetting, setSetting } from '../db/database';
import { pendingCheckIn } from './scheduleHelper';
import * as Device from 'expo-device';
import { needsOverlayFallback } from '../utils/device';
import { trackAlarmFired } from './analytics';
import { errorMessage } from '../utils/errors';

// Must match the key the Settings screen saves to (App.tsx). It used to read
// 'alarm_sound_id' while Settings saved 'alarm_sound', so the chosen tone was
// never played.
export const ALARM_SOUND_SETTING_KEY = 'alarm_sound';
export const PRE_WAKE_WINDOW_SETTING_KEY = 'pre_wake_window_minutes';

const ALARM_CHANNEL_ID = 'morning-ritual-alarm-v2';
const ALARM_CHANNEL_NAME = 'KindRise Alarm';
const ALARM_CATEGORY_ID = 'morning-ritual-alarm';

let initialized = false;
let activeAlarmTimer: ReturnType<typeof setTimeout> | null = null;
let activeAlarmId: string | null = null;
let activeSound: AudioPlayer | null = null;
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

/** The data attached to alarm notifications scheduled by this service. */
type AlarmNotificationData = { type?: string; taskId?: string; taskText?: string };

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

/** The bundled tone the user picked in Settings (the default if none). */
async function chosenSoundFile(): Promise<number> {
  try {
    const id = await getSetting(ALARM_SOUND_SETTING_KEY);
    const chosen = id ? SOUND_OPTIONS.find((o) => o.id === id) : undefined;
    if (chosen) return chosen.file;
  } catch {
    // Fall back to the default sound if the settings read fails.
  }
  return getSoundById(DEFAULT_SOUND_ID).file;
}

/**
 * A file:// copy of the chosen tone that the native ringer can play. Bundled
 * assets live inside the APK; expo-asset copies them to the cache on demand.
 * Returns undefined if that fails, and the ringer then uses the phone's
 * default alarm tone.
 */
export async function resolveAlarmSoundUri(): Promise<string | undefined> {
  try {
    const asset = Asset.fromModule(await chosenSoundFile());
    await asset.downloadAsync();
    const uri = asset.localUri ?? undefined;
    return uri && uri.startsWith('file://') ? uri : undefined;
  } catch (e: unknown) {
    console.warn(`[alarm] could not resolve alarm tone: ${e instanceof Error ? e.message : String(e)}`);
    return undefined;
  }
}

/**
 * Ring the alarm. On Android this starts the native AlarmRingService (looping
 * tone on the alarm stream, vibration, works with the screen locked). If the
 * native alarm is already ringing nothing restarts. Elsewhere, or if the
 * native ringer fails, it plays the tone in-app with expo-audio. Race-safe via
 * a generation counter.
 */
export async function playAlarmSound(): Promise<void> {
  if (Platform.OS === 'web') return;
  const myGen = ++soundGeneration;
  if (Platform.OS === 'android') {
    try {
      if (!AlarmScheduler.isRinging()) {
        await AlarmScheduler.startRinging({ taskId: 'in-app', taskText: '', soundUri: await resolveAlarmSoundUri() });
      }
      return;
    } catch (e: unknown) {
      console.warn(`[alarm] native ringer failed, using in-app sound: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  try {
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      // Exclusive audio focus: other apps pause rather than duck under the alarm.
      interruptionMode: 'doNotMix',
      // Keep ringing if the user leaves the app before finishing the ritual.
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
    });

    if (myGen !== soundGeneration) return;
    releaseActiveSound();

    const soundFile = await chosenSoundFile();

    if (myGen !== soundGeneration) return;

    const player = createAudioPlayer(soundFile);
    player.loop = true;
    player.volume = 1.0;
    player.play();
    activeSound = player;
  } catch (e: unknown) {
    console.error(`[alarm] failed to play alarm sound: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Android: show the app over the lock screen during the morning flow. */
export async function showOverLockScreen(show: boolean): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await AlarmScheduler.setShowWhenLocked(show);
  } catch {
    // Not available (tests); harmless.
  }
}

/** Android 14+: whether the alarm may open full screen over the lock screen. */
export async function canShowFullScreenAlarm(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return await AlarmScheduler.canUseFullScreenIntent();
  } catch {
    return true;
  }
}

export async function openFullScreenAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await AlarmScheduler.openFullScreenIntentSettings();
  } catch {
    // Ignore; the home screen keeps showing the warning.
  }
}

/**
 * Android: can the ringer open the wake-up screen by itself? Needs "Display
 * over other apps", because some skins (OriginOS, MIUI) reject full-screen
 * intents even when the user allowed them.
 */
export async function canOpenWakeScreenOverLockScreen(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  // Only phone brands that reject full-screen alarms need this permission;
  // on others report "fine" so we never ask for it.
  if (!needsOverlayFallback(Device.manufacturer)) return true;
  try {
    return await AlarmScheduler.canDrawOverlays();
  } catch {
    return true;
  }
}

export async function openDisplayOverAppsSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await AlarmScheduler.openOverlaySettings();
  } catch {
    // Ignore; the home screen keeps showing the warning.
  }
}

/**
 * The "Still up?" follow-up: a separate native alarm about 10 minutes after the
 * morning flow ends. It starts quiet and rises like the main alarm, and the
 * check-in screen stops it with one tap. Uses its own ID, so it never touches
 * the next real alarm.
 */
export const CHECK_IN_ALARM_ID = 'checkin';
export const CHECK_IN_DELAY_MINUTES = 10;

export function isCheckInAlarm(taskId: string | undefined | null): boolean {
  return taskId === CHECK_IN_ALARM_ID;
}

const CHECK_IN_SETTING_KEY = 'checkin_at';

export async function scheduleCheckIn(now: Date = new Date()): Promise<Date | null> {
  if (Platform.OS !== 'android') return null;
  const fireAt = new Date(now.getTime() + CHECK_IN_DELAY_MINUTES * 60 * 1000);
  return bookCheckIn(fireAt);
}

/**
 * Re-book a "Still up?" that is still due. syncAlarms() clears the whole native
 * queue before booking the next alarm, so it calls this straight afterwards.
 */
export async function rebookPendingCheckIn(now: Date = new Date()): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const at = pendingCheckIn(await getSetting(CHECK_IN_SETTING_KEY), now);
    if (at) await bookCheckIn(at);
  } catch (e) {
    console.warn(`[alarm] could not re-book the check-in: ${errorMessage(e)}`);
  }
}

async function bookCheckIn(fireAt: Date): Promise<Date | null> {
  try {
    await setSetting(CHECK_IN_SETTING_KEY, fireAt.toISOString());
    await AlarmScheduler.scheduleAlarm({
      taskId: CHECK_IN_ALARM_ID,
      taskText: 'Still up?',
      triggerAtMillis: fireAt.getTime(),
      preWakeWindowMinutes: 0,
      soundUri: await resolveAlarmSoundUri(),
    });
    console.log(`[alarm] check-in booked for ${fireAt.toISOString()}`);
    return fireAt;
  } catch (e) {
    console.warn(`[alarm] could not book the check-in: ${errorMessage(e)}`);
    return null;
  }
}

export async function cancelCheckIn(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await setSetting(CHECK_IN_SETTING_KEY, '');
    await AlarmScheduler.cancelAlarm(CHECK_IN_ALARM_ID);
  } catch {
    // Nothing booked.
  }
}

/** Whisper while the wake check is on screen; false lets the tone rise again. */
export async function setAlarmQuiet(quiet: boolean): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await AlarmScheduler.setRingQuiet(quiet);
      return;
    } catch {
      // Older native build or tests; fall through to the in-app player.
    }
  }
  if (activeSound) activeSound.volume = quiet ? 0.06 : 1.0;
}

/** Android: subscribe to alarms firing while the app is already running. */
export function addNativeAlarmListener(onFire: (taskId: string) => void): () => void {
  if (Platform.OS !== 'android') return () => {};
  try {
    const sub = AlarmScheduler.addAlarmFireListener((event) => onFire(event.taskId));
    return () => sub?.remove?.();
  } catch {
    return () => {};
  }
}

function releaseActiveSound(): void {
  if (!activeSound) return;
  try {
    activeSound.pause();
    activeSound.remove();
  } catch {
    // Already released.
  }
  activeSound = null;
}

/**
 * Stop the in-app alarm sound. Race-safe: invalidates any in-flight play.
 */
export async function stopAlarmSound(): Promise<void> {
  soundGeneration++;
  releaseActiveSound();
  if (Platform.OS === 'android') {
    try {
      await AlarmScheduler.stopRinging();
      // The morning flow is over: stop showing the app over the lock screen.
      await AlarmScheduler.setShowWhenLocked(false);
      await AlarmScheduler.clearLastFiredAlarm();
    } catch {
      // Native module unavailable (tests, web); the in-app sound is already stopped.
    }
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
      const data = notification.request.content.data as AlarmNotificationData | undefined;
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
    const data = response.notification.request.content.data as AlarmNotificationData | undefined;
    if (data?.type === 'alarm') {
      invokeCallback(data.taskId ?? 'alarm', data.taskText ?? '', 'js_background');
    }
  });

  // Native module warm-start listener: fires when AlarmFireReceiver is
  // invoked and the JS context is alive (app in background but not killed).
  try {
    AlarmScheduler.addAlarmFireListener((event) => {
      console.log(`[alarm] native onAlarmFire (warm): ${event.taskId}`);
      invokeCallback(event.taskId, event.taskText, 'native');
    });
  } catch (e) {
    console.warn(`[alarm] failed to attach native alarm listener: ${errorMessage(e)}`);
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
  } catch (e) {
    console.warn(`[alarm] consumeColdStartAlarm failed: ${errorMessage(e)}`);
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
  } catch (e) {
    console.warn(`[alarm] failed to persist alarm: ${errorMessage(e)}`);
  }

  activeAlarmId = id;
  let nativeScheduled = false;

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
      const soundUri = await resolveAlarmSoundUri();
      await AlarmScheduler.scheduleAlarm({ taskId: id, taskText, triggerAtMillis, preWakeWindowMinutes, soundUri });
      nativeScheduled = true;
      console.log(`[alarm] native alarm scheduled id=${id}, preWake=${preWakeWindowMinutes}m`);
    } catch (e) {
      console.error(`[alarm] native schedule failed: ${errorMessage(e)}`);
      // Fall through to JS path below
    }
  }

  // ---- Secondary: expo-notifications timeInterval (iOS, or Android fallback) ----
  // Skipped when the native alarm is booked: it rings and notifies by itself,
  // and a second notification at the same moment was a duplicate.
  if (!nativeScheduled) try {
    const delaySec = Math.max(1, Math.round(delayMs / 1000));
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'KindRise: time to get up',
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
  } catch (e) {
    console.error(`[alarm] expo-notifications schedule failed: ${errorMessage(e)}`);
  }

  // ---- Tertiary: JS setTimeout (foreground / in-app reliability) ----
  activeAlarmTimer = setTimeout(async () => {
    console.log(`[alarm] JS timer fired (foreground only), id=${id}`);
    activeAlarmTimer = null;
    if (nativeScheduled) {
      // The native ringer is already ringing; just bring up the wake screen.
      invokeCallback(taskId, taskText, 'js_timer');
      return;
    }
    try {
      await displayAlarmNotification({
        id,
        taskId,
        taskText,
        fireAt: fireAt.toISOString(),
        createdAt: new Date().toISOString(),
        fired: false,
      });
    } catch (e) {
      console.error(`[alarm] JS timer notification failed: ${errorMessage(e)}`);
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

/**
 * Remove every scheduled alarm (native AlarmManager entries, alarm
 * notifications and the SQLite queue) without touching a sound that is
 * ringing right now or other notifications such as the bedtime reminder.
 * Called before each new schedule so only one alarm is ever queued: alarm IDs
 * are unique per schedule and the in-memory activeAlarmId is lost on restart.
 */
export async function clearScheduledAlarms(): Promise<void> {
  await cancelActiveAlarmInternal();
  if (Platform.OS === 'android') {
    try {
      await AlarmScheduler.cancelAllAlarms();
    } catch {}
  }
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.data?.type === 'alarm') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {}
  await clearPendingAlarms();
}

export async function cancelAllAlarms(): Promise<void> {
  await clearScheduledAlarms();
  await stopAlarmSound();
}

async function displayAlarmNotification(alarm: ScheduledAlarm): Promise<void> {
  await playAlarmSound();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'KindRise',
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
  /** ID of the alarm that fired while the app was closed, if any. */
  coldStartTaskId: string | null;
}> {
  await initAlarmService();

  // 1) Missed alarms. On Android the native AlarmManager alarm already rang for
  //    them (even with the app killed), so firing them again from JS was the
  //    duplicate notification. Just mark them fired there.
  const missed = await getMissedAlarms();
  for (const alarm of missed) {
    try {
      if (Platform.OS === 'android') {
        await markAlarmFired(alarm.id);
      } else {
        console.log(`[alarm] firing missed alarm id=${alarm.id}, fireAt=${alarm.fireAt}`);
        await displayAlarmNotification(alarm);
      }
    } catch (e) {
      console.error(`[alarm] failed to handle missed alarm: ${errorMessage(e)}`);
    }
  }

  // 2) Re-schedule pending alarms. On Android, syncAlarms() runs straight after
  //    app start and re-books the next alarm cleanly, so this is iOS-only.
  const pending = Platform.OS === 'android' ? [] : await getPendingAlarms();
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
      } catch (e) {
        console.error(`[alarm] native reschedule failed: ${errorMessage(e)}`);
      }
    }

    // expo-notifications timeInterval
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'KindRise: time to get up',
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
    } catch (e) {
      console.error(`[alarm] expo-notifications reschedule failed: ${errorMessage(e)}`);
    }

    rescheduled++;
  }

  // 3) Cold-start detection — the native module has a lastFired entry
  let coldStartFired = false;
  let coldStartTaskId: string | null = null;
  if (Platform.OS === 'android') {
    try {
      const cold = await AlarmScheduler.consumeLastFiredAlarm();
      if (cold) {
        coldStartFired = true;
        coldStartTaskId = cold.taskId;
        console.log(`[alarm] cold-start fired alarm detected: ${cold.taskId}`);
      }
    } catch (e) {
      console.warn(`[alarm] cold-start detection failed: ${errorMessage(e)}`);
    }
  }

  return { missed: missed.length, rescheduled, coldStartFired, coldStartTaskId };
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
    } catch (e) {
      console.error(`[alarm] delayed notification failed: ${errorMessage(e)}`);
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
