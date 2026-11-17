// modules/alarm-scheduler/src/index.ts
// TypeScript bridge to the native AlarmScheduler module.
//
// Why this exists:
//   expo-notifications' `timeInterval` trigger is unreliable on iQOO / Vivo
//   / Xiaomi because those OEM skins aggressively delay or drop scheduled
//   notifications. The native Android AlarmManager.setExactAndAllowWhileIdle()
//   is much harder to suppress — it triggers a wake lock and is the API
//   the Google Clock app uses.
//
// Flow:
//   1. scheduleAlarmNative() calls the native module's scheduleAlarm()
//   2. The native module registers with AlarmManager.setExactAndAllowWhileIdle()
//   3. At trigger time, the OS invokes AlarmFireReceiver
//   4. The receiver posts a high-importance notification + writes to
//      SharedPreferences for cold-start pickup
//   5. When the user opens the app, the JS layer calls consumeLastFiredAlarm()
//      and routes to WakeUpScreen
//   6. For the warm-start case (app in background but JS context alive),
//      the AlarmFireReceiver emits an event to the JS layer

// SDK 58: import native-module helpers from 'expo', not 'expo-modules-core' directly.
import { NativeModule, requireNativeModule } from 'expo';

export type ScheduledNativeAlarm = {
  taskId: string;
  taskText: string;
  triggerAtMillis: number;
};

type NativeAlarmSchedulerModule = NativeModule<{
  onAlarmFire: (event: { taskId: string; taskText: string; fireAt: number }) => void;
}> & {
  scheduleAlarm(params: ScheduleParams): Promise<string>;
  cancelAlarm(taskId: string): Promise<void>;
  cancelAllAlarms(): Promise<void>;
  getScheduledAlarms(): Promise<ScheduledNativeAlarm[]>;
  canScheduleExactAlarms(): Promise<boolean>;
  requestExactAlarmPermission(): Promise<boolean>;
  consumeLastFiredAlarm(): Promise<{ taskId: string; taskText: string; fireAt: number } | null>;
  clearLastFiredAlarm(): Promise<void>;
  startRinging(params: { taskId: string; taskText: string; soundUri?: string }): Promise<boolean>;
  stopRinging(): Promise<void>;
  isRinging(): boolean;
  canUseFullScreenIntent(): Promise<boolean>;
  openFullScreenIntentSettings(): Promise<boolean>;
  setShowWhenLocked(show: boolean): Promise<boolean>;
};

export type ScheduleParams = {
  taskId: string;
  taskText: string;
  triggerAtMillis: number;
  preWakeWindowMinutes?: number;
  /** file:// URI of the tone to ring with; the phone's default alarm tone if missing. */
  soundUri?: string;
};

const nativeModule = requireNativeModule<NativeAlarmSchedulerModule>('AlarmScheduler');

export type AlarmFireEvent = {
  taskId: string;
  taskText: string;
  fireAt: number;
};

export const AlarmScheduler = {
  scheduleAlarm: (params: ScheduleParams): Promise<string> =>
    nativeModule.scheduleAlarm(params),

  /** Loop the alarm tone on the alarm stream with vibration (foreground service). */
  startRinging: (params: { taskId: string; taskText: string; soundUri?: string }): Promise<boolean> =>
    nativeModule.startRinging(params),

  stopRinging: (): Promise<void> => nativeModule.stopRinging(),

  isRinging: (): boolean => nativeModule.isRinging(),

  /** Android 14+: whether the alarm may open full screen over the lock screen. */
  canUseFullScreenIntent: (): Promise<boolean> => nativeModule.canUseFullScreenIntent(),

  openFullScreenIntentSettings: (): Promise<boolean> => nativeModule.openFullScreenIntentSettings(),

  /** Show the app over the lock screen (on during the morning flow, off after). */
  setShowWhenLocked: (show: boolean): Promise<boolean> => nativeModule.setShowWhenLocked(show),

  cancelAlarm: (taskId: string): Promise<void> =>
    nativeModule.cancelAlarm(taskId),

  cancelAllAlarms: (): Promise<void> =>
    nativeModule.cancelAllAlarms(),

  getScheduledAlarms: (): Promise<ScheduledNativeAlarm[]> =>
    nativeModule.getScheduledAlarms(),

  canScheduleExactAlarms: (): Promise<boolean> =>
    nativeModule.canScheduleExactAlarms(),

  requestExactAlarmPermission: (): Promise<boolean> =>
    nativeModule.requestExactAlarmPermission(),

  consumeLastFiredAlarm: (): Promise<AlarmFireEvent | null> =>
    nativeModule.consumeLastFiredAlarm(),

  clearLastFiredAlarm: (): Promise<void> =>
    nativeModule.clearLastFiredAlarm(),

  /**
   * Listen for warm-start alarm fires (app in background but JS context alive).
   * For cold-start, use consumeLastFiredAlarm() on app launch.
   */
  addAlarmFireListener: (listener: (event: AlarmFireEvent) => void) => {
    return (nativeModule as any).addListener('onAlarmFire', listener);
  },
};

export default AlarmScheduler;
