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

import { NativeModule, requireNativeModule } from 'expo-modules-core';

export type ScheduledNativeAlarm = {
  taskId: string;
  taskText: string;
  triggerAtMillis: number;
};

type NativeAlarmSchedulerModule = NativeModule<{
  onAlarmFire: (event: { taskId: string; taskText: string; fireAt: number }) => void;
}> & {
  scheduleAlarm(params: { taskId: string; taskText: string; triggerAtMillis: number; preWakeWindowMinutes?: number }): Promise<string>;
  cancelAlarm(taskId: string): Promise<void>;
  cancelAllAlarms(): Promise<void>;
  getScheduledAlarms(): Promise<ScheduledNativeAlarm[]>;
  canScheduleExactAlarms(): Promise<boolean>;
  requestExactAlarmPermission(): Promise<boolean>;
  consumeLastFiredAlarm(): Promise<{ taskId: string; taskText: string; fireAt: number } | null>;
  clearLastFiredAlarm(): Promise<void>;
};

const nativeModule = requireNativeModule<NativeAlarmSchedulerModule>('AlarmScheduler');

export type AlarmFireEvent = {
  taskId: string;
  taskText: string;
  fireAt: number;
};

export const AlarmScheduler = {
  scheduleAlarm: (params: { taskId: string; taskText: string; triggerAtMillis: number; preWakeWindowMinutes?: number }): Promise<string> =>
    nativeModule.scheduleAlarm(params),

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
