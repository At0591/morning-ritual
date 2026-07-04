package expo.modules.alarmscheduler

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat

/**
 * AlarmFireReceiver — invoked by AlarmManager.setExactAndAllowWhileIdle()
 * when the alarm time arrives. This is the bulletproof path that survives:
 *   - Phone is locked
 *   - App is killed
 *   - Device is in Doze mode (because setExactAndAllowWhileIdle explicitly
 *     bypasses Doze batching)
 *   - iQOO / Vivo / Xiaomi aggressive background kill (because the OS holds
 *     a wakelock for this broadcast)
 *
 * What it does:
 *   1. Writes the "last fired" entry to SharedPreferences so JS can pick it
 *      up on cold start (the app may be killed when the alarm fires)
 *   2. Posts a high-importance notification with full-screen intent and the
 *      default alarm sound — this is what wakes the phone, plays sound, and
 *      shows up on the lock screen
 *   3. The notification's content intent opens the app to the launcher
 *      activity, where the JS layer reads the last-fired entry and routes
 *      to WakeUpScreen
 *
 * The notification's "Ringstone" toggle (iQOO's mute-by-default) is the one
 * thing the user must enable manually. The app's in-app help banner walks
 * them through it.
 */
class AlarmFireReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    val taskId = intent.getStringExtra(AlarmSchedulerModule.EXTRA_TASK_ID) ?: return
    val taskText = intent.getStringExtra(AlarmSchedulerModule.EXTRA_TASK_TEXT) ?: ""
    val fireAt = System.currentTimeMillis()

    val isPreWake = intent.getBooleanExtra(AlarmSchedulerModule.EXTRA_IS_PRE_WAKE, false)
    val realTriggerMillis = intent.getLongExtra(AlarmSchedulerModule.EXTRA_REAL_TRIGGER_MILLIS, 0L)

    if (isPreWake) {
      val serviceIntent = Intent(context, SmartWakeService::class.java).apply {
        putExtra(AlarmSchedulerModule.EXTRA_TASK_ID, taskId)
        putExtra(AlarmSchedulerModule.EXTRA_TASK_TEXT, taskText)
        putExtra(AlarmSchedulerModule.EXTRA_REAL_TRIGGER_MILLIS, realTriggerMillis)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(serviceIntent)
      } else {
        context.startService(serviceIntent)
      }
    } else {
      // 1) Persist for cold-start pickup
      AlarmSchedulerModule.recordLastFired(context, taskId, taskText, fireAt)

      // 2) Post the lock-screen notification
      postAlarmNotification(context, taskId, taskText)
    }
  }

  private fun postAlarmNotification(context: Context, taskId: String, taskText: String) {
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channelId = CHANNEL_ID

    // Create or update the channel. We use a separate channel from
    // expo-notifications' so the system settings show "Morning Ritual
    // Alarm" cleanly and we can ensure it always has the right sound.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        channelId,
        CHANNEL_NAME,
        NotificationManager.IMPORTANCE_MAX
      ).apply {
        description = "High-priority alarm notifications for the Morning Ritual app"
        // Use the system alarm sound + alarm audio attributes so this is
        // treated as a real alarm (not a notification) — bypasses DND
        // and respects the user's alarm volume rather than ringtone volume
        val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        setSound(
          alarmUri,
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 400, 250, 400, 250, 400, 250, 400)
        setBypassDnd(true)
        setShowBadge(true)
        lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
      }
      nm.createNotificationChannel(channel)
    }

    // Tap → opens the app to its launcher activity. JS will read the
    // lastFired entry on mount and route to WakeUpScreen.
    val openIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?.apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP }
      ?: Intent()
    val openPi = PendingIntent.getActivity(
      context, taskId.hashCode() + 1, openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    // Build the notification. PRIORITY_MAX + category ALARM + fullScreenIntent
    // = shows on top of the lock screen and triggers the alarm sound.
    val notif = NotificationCompat.Builder(context, channelId)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle("🌅 Morning Ritual")
      .setContentText(taskText)
      .setStyle(NotificationCompat.BigTextStyle().bigText(taskText))
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setFullScreenIntent(openPi, true)  // THE KEY: shows on lock screen
      .setContentIntent(openPi)
      .setAutoCancel(true)
      .setOngoing(false)
      .setDefaults(NotificationCompat.DEFAULT_LIGHTS or NotificationCompat.DEFAULT_VIBRATE)
      .build()

    nm.notify(taskId.hashCode(), notif)
  }

  companion object {
    const val CHANNEL_ID = "morning-ritual-alarm-native"
    const val CHANNEL_NAME = "Morning Ritual Alarm"
  }
}
