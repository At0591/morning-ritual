package expo.modules.alarmscheduler

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.events.EventEmitter
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * AlarmScheduler — a native bridge to Android's AlarmManager.
 *
 * Uses `setExactAndAllowWhileIdle()` (the Doze-aware API the Google Clock
 * app uses) so the alarm fires reliably even when the phone is locked,
 * the app is killed, or the device is in Doze mode.
 *
 * Why not use expo-notifications timeInterval trigger?
 *   On iQOO / Vivo / Xiaomi (Funtouch OS, OriginOS, MIUI) the system
 *   aggressively delays or drops scheduled notifications when the app
 *   is not on the auto-start list, even if the channel has MAX importance.
 *   `setExactAndAllowWhileIdle` is much harder to suppress — it triggers
 *   a wake lock and a foreground-service-style notification.
 *
 * Flow:
 *   1. JS calls `scheduleAlarm({ triggerAtMillis, taskId, taskText })`
 *   2. We compute the Intent + PendingIntent targeting AlarmFireReceiver
 *   3. We call alarmManager.setExactAndAllowWhileIdle(RTC_WAKEUP, ...)
 *   4. The OS holds a wakelock and invokes AlarmFireReceiver at trigger time
 *   5. AlarmFireReceiver posts a high-importance notification with
 *      full-screen intent, and writes a "lastFired" SharedPreferences entry
 *   6. When the user opens the app, JS reads lastFired and navigates to
 *      WakeUpScreen
 */
class AlarmSchedulerModule : Module() {

  private val prefs: SharedPreferences
    get() = appContext.reactContext!!
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  override fun definition() = ModuleDefinition {
    Name("AlarmScheduler")

    // JS can subscribe to this for the warm-start case (app in background
    // but JS context alive). For cold start, the JS layer reads
    // `getLastFiredAlarm()` on launch and routes accordingly.
    Events("onAlarmFire")

    AsyncFunction("scheduleAlarm") { params: Map<String, Any>, promise: Promise ->
      val context = appContext.reactContext!!
          ?: return@AsyncFunction promise.reject("NO_CONTEXT", "No react context available", null)

      val taskId = params["taskId"] as? String
          ?: return@AsyncFunction promise.reject("MISSING_TASK_ID", "taskId is required", null)
      val taskText = params["taskText"] as? String ?: ""
      val triggerAtMillis = (params["triggerAtMillis"] as? Number)?.toLong()
          ?: return@AsyncFunction promise.reject("MISSING_TRIGGER", "triggerAtMillis is required", null)
      val preWakeWindowMinutes = (params["preWakeWindowMinutes"] as? Number)?.toLong() ?: 0L

      val actualTriggerMillis = if (preWakeWindowMinutes > 0) {
          triggerAtMillis - (preWakeWindowMinutes * 60 * 1000)
      } else {
          triggerAtMillis
      }

      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

      // If exact alarms are not allowed, fall back to setAndAllowWhileIdle
      // (inexact but allowed without the special permission)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
        try {
          val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
            .apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK }
          ContextCompat.startActivity(context, intent, null)
        } catch (_: Exception) { /* settings activity not available */ }
        return@AsyncFunction promise.reject(
          "EXACT_ALARM_NOT_ALLOWED",
          "Exact alarm permission not granted. Open Settings → Apps → Morning Ritual → Special access → Alarms & reminders, and grant.",
          null
        )
      }

      val intent = Intent(context, AlarmFireReceiver::class.java).apply {
        action = ACTION_FIRE
        putExtra(EXTRA_TASK_ID, taskId)
        putExtra(EXTRA_TASK_TEXT, taskText)
        putExtra(EXTRA_IS_PRE_WAKE, preWakeWindowMinutes > 0)
        putExtra(EXTRA_REAL_TRIGGER_MILLIS, triggerAtMillis)
        // Explicit package — Android 12+ requires this for implicit broadcasts
        setPackage(context.packageName)
      }
      val pi = PendingIntent.getBroadcast(
        context, taskId.hashCode(), intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      try {
        // setAlarmClock is the STRONGEST API — it bypasses Doze, battery
        // saver, AND app standby. It also shows in the status bar so the
        // user can see the upcoming alarm. This is what the Google Clock
        // app uses. Required on iQOO / Vivo (ColorOS) where the system
        // "freezes" alarms registered via setExactAndAllowWhileIdle.
        //
        // First arg: AlarmClockInfo wraps the trigger time and a "show"
        // intent (what to launch if the user taps the alarm icon in the
        // status bar). We point it at the same AlarmFireReceiver.
        val showIntent = Intent(context, AlarmFireReceiver::class.java).apply {
          action = ACTION_FIRE
          putExtra(EXTRA_TASK_ID, taskId)
          putExtra(EXTRA_TASK_TEXT, taskText)
          setPackage(context.packageName)
        }
        val showPi = PendingIntent.getBroadcast(
          context, ("show-$taskId").hashCode(), showIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val info = AlarmManager.AlarmClockInfo(actualTriggerMillis, showPi)
        alarmManager.setAlarmClock(info, pi)

        // Persist the alarm for boot-time restoration
        prefs.edit()
          .putLong("${PREF_KEY_TRIGGER}$taskId", actualTriggerMillis)
          .putLong("${PREF_KEY_REAL_TRIGGER}$taskId", triggerAtMillis)
          .putBoolean("${PREF_KEY_IS_PRE_WAKE}$taskId", preWakeWindowMinutes > 0)
          .putString("${PREF_KEY_TASK_TEXT}$taskId", taskText)
          .putString(PREF_KEY_LAST_SCHEDULED, taskId)
          .apply()

        promise.resolve(taskId)
      } catch (e: SecurityException) {
        promise.reject("SECURITY", "AlarmManager.setExactAndAllowWhileIdle denied: ${e.message}", null)
      } catch (e: Exception) {
        promise.reject("SCHEDULE_FAILED", e.message ?: "Unknown error scheduling alarm", null)
      }
    }

    AsyncFunction("cancelAlarm") { taskId: String, promise: Promise ->
      val context = appContext.reactContext!!
          ?: return@AsyncFunction promise.reject("NO_CONTEXT", "No react context", null)

      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val intent = Intent(context, AlarmFireReceiver::class.java).apply {
        action = ACTION_FIRE
        setPackage(context.packageName)
      }
      val pi = PendingIntent.getBroadcast(
        context, taskId.hashCode(), intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      alarmManager.cancel(pi)

      prefs.edit()
        .remove("${PREF_KEY_TRIGGER}$taskId")
        .remove("${PREF_KEY_TASK_TEXT}$taskId")
        .apply()

      promise.resolve(null)
    }

    AsyncFunction("cancelAllAlarms") { promise: Promise ->
      val context = appContext.reactContext!!
          ?: return@AsyncFunction promise.reject("NO_CONTEXT", "No react context", null)

      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      // Cancel all alarms that match our receiver
      // PendingIntent.FLAG_NO_CREATE means we don't create a new PI; returns
      // null if there's no matching PI (which means no scheduled alarm).
      val intent = Intent(context, AlarmFireReceiver::class.java).apply {
        action = ACTION_FIRE
        setPackage(context.packageName)
      }
      // Iterate all our persisted alarms and cancel each
      val all = prefs.all
      for ((key, value) in all) {
        if (key.startsWith(PREF_KEY_TRIGGER) && value is Long) {
          val taskId = key.removePrefix(PREF_KEY_TRIGGER)
          val pi = PendingIntent.getBroadcast(
            context, taskId.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
          )
          alarmManager.cancel(pi)
        }
      }
      prefs.edit().clear().apply()
      promise.resolve(null)
    }

    AsyncFunction("getScheduledAlarms") { promise: Promise ->
      val all = prefs.all
      val out = mutableListOf<Map<String, Any>>()
      for ((key, value) in all) {
        if (key.startsWith(PREF_KEY_TRIGGER) && value is Long) {
          val taskId = key.removePrefix(PREF_KEY_TRIGGER)
          val taskText = prefs.getString("${PREF_KEY_TASK_TEXT}$taskId", "") ?: ""
          out.add(mapOf(
            "taskId" to taskId,
            "taskText" to taskText,
            "triggerAtMillis" to value
          ))
        }
      }
      promise.resolve(out)
    }

    AsyncFunction("canScheduleExactAlarms") { promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val am = appContext.reactContext!!.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        promise.resolve(am.canScheduleExactAlarms())
      } else {
        promise.resolve(true)
      }
    }

    AsyncFunction("requestExactAlarmPermission") { promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val am = appContext.reactContext!!.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        if (am.canScheduleExactAlarms()) {
          promise.resolve(true)
        } else {
          try {
            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
              .apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK }
            ContextCompat.startActivity(appContext.reactContext!!, intent, null)
          } catch (_: Exception) {}
          promise.resolve(false)
        }
      } else {
        promise.resolve(true)
      }
    }

    // Cold-start detection: returns the last alarm that fired, then clears it.
    // JS calls this on app launch; if non-null, route to WakeUpScreen.
    AsyncFunction("consumeLastFiredAlarm") { promise: Promise ->
      val taskId = prefs.getString(PREF_KEY_LAST_FIRED, null)
      val taskText = prefs.getString(PREF_KEY_LAST_FIRED_TEXT, null)
      val fireAt = prefs.getLong(PREF_KEY_LAST_FIRED_AT, 0L)
      // Don't clear here — leave it so the user can re-open the app and still
      // see the alarm. Clear only on user dismissal.
      if (taskId != null) {
        promise.resolve(mapOf(
          "taskId" to taskId,
          "taskText" to (taskText ?: ""),
          "fireAt" to fireAt
        ))
      } else {
        promise.resolve(null)
      }
    }

    AsyncFunction("clearLastFiredAlarm") { promise: Promise ->
      prefs.edit()
        .remove(PREF_KEY_LAST_FIRED)
        .remove(PREF_KEY_LAST_FIRED_TEXT)
        .remove(PREF_KEY_LAST_FIRED_AT)
        .apply()
      promise.resolve(null)
    }
  }

  companion object {
    const val PREFS_NAME = "alarm_scheduler_prefs"
    const val ACTION_FIRE = "expo.modules.alarmscheduler.FIRE"
    const val EXTRA_TASK_ID = "taskId"
    const val EXTRA_TASK_TEXT = "taskText"
    const val PREF_KEY_TRIGGER = "trigger_"
    const val PREF_KEY_REAL_TRIGGER = "real_trigger_"
    const val PREF_KEY_IS_PRE_WAKE = "is_pre_wake_"
    const val PREF_KEY_TASK_TEXT = "tasktext_"
    const val PREF_KEY_LAST_SCHEDULED = "last_scheduled"
    const val PREF_KEY_LAST_FIRED = "last_fired_id"
    const val PREF_KEY_LAST_FIRED_TEXT = "last_fired_text"
    const val PREF_KEY_LAST_FIRED_AT = "last_fired_at"
    const val EXTRA_IS_PRE_WAKE = "isPreWake"
    const val EXTRA_REAL_TRIGGER_MILLIS = "realTriggerMillis"

    /**
     * Called by AlarmFireReceiver to write the last-fired info so the JS
     * layer can pick it up on cold start.
     */
    @JvmStatic
    fun recordLastFired(context: Context, taskId: String, taskText: String, fireAt: Long) {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit()
        .putString(PREF_KEY_LAST_FIRED, taskId)
        .putString(PREF_KEY_LAST_FIRED_TEXT, taskText)
        .putLong(PREF_KEY_LAST_FIRED_AT, fireAt)
        .apply()
    }
  }
}
