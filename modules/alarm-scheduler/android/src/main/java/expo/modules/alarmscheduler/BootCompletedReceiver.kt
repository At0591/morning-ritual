package expo.modules.alarmscheduler

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * BootCompletedReceiver — re-arms pending alarms after a device reboot.
 *
 * Android's AlarmManager loses all scheduled alarms when the device reboots
 * (this is by design — the OS doesn't know if the user wants the alarm
 * still active). Without this receiver, the user would have to re-set the
 * alarm every morning after a reboot.
 *
 * The receiver re-arms the most recent alarm from SharedPreferences using
 * the same setExactAndAllowWhileIdle() call. We only restore the latest
 * alarm (Morning Ritual is a single-alarm app in v1.0).
 *
 * LOCKED_BOOT_COMPLETED is fired before the user unlocks the device (so
 * the alarm can fire while the phone is still locked). BOOT_COMPLETED
 * is fired after the user unlocks. We handle both.
 */
class BootCompletedReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val receivedAction = intent.action ?: return
    if (receivedAction != Intent.ACTION_BOOT_COMPLETED &&
        receivedAction != Intent.ACTION_LOCKED_BOOT_COMPLETED &&
        receivedAction != "android.intent.action.QUICKBOOT_POWERON") return

    val prefs = context.getSharedPreferences(AlarmSchedulerModule.PREFS_NAME, Context.MODE_PRIVATE)
    val lastTaskId = prefs.getString(AlarmSchedulerModule.PREF_KEY_LAST_SCHEDULED, null) ?: return
    val triggerAt = prefs.getLong("${AlarmSchedulerModule.PREF_KEY_TRIGGER}$lastTaskId", 0L)
    if (triggerAt <= System.currentTimeMillis()) return // already past

    val taskText = prefs.getString("${AlarmSchedulerModule.PREF_KEY_TASK_TEXT}$lastTaskId", "") ?: ""

    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val fireIntent = Intent(context, AlarmFireReceiver::class.java).apply {
      action = AlarmSchedulerModule.ACTION_FIRE
      putExtra(AlarmSchedulerModule.EXTRA_TASK_ID, lastTaskId)
      putExtra(AlarmSchedulerModule.EXTRA_TASK_TEXT, taskText)
      setPackage(context.packageName)
    }
    val pi = PendingIntent.getBroadcast(
      context, lastTaskId.hashCode(), fireIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    // Use setAlarmClock (strongest API — bypasses iQOO ColorOS freeze).
    val showPi = PendingIntent.getBroadcast(
      context, ("show-$lastTaskId").hashCode(), fireIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val info = AlarmManager.AlarmClockInfo(triggerAt, showPi)
    alarmManager.setAlarmClock(info, pi)
  }
}
