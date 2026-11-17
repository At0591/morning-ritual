package expo.modules.alarmscheduler

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * AlarmRingService: rings the alarm like a real clock app.
 *
 * Before this service, the only sound was the notification's own sound. That
 * plays once, and Vivo/iQOO/Xiaomi let users (and defaults) mute app
 * notification sounds, so alarms fired silently. This foreground service:
 *   - plays the chosen tone (or the phone's default alarm tone) in a loop on
 *     the ALARM audio stream, which notification settings don't mute
 *   - vibrates in a repeating pattern
 *   - holds a partial wake lock so the CPU stays up while ringing
 *   - shows an ongoing alarm notification with a full-screen intent that opens
 *     the app over the lock screen (see EXTRA_FROM_ALARM)
 * It stops when JS calls stopRinging() (ritual done, skipped or snoozed) or
 * after MAX_RING_MS as a safety net.
 */
class AlarmRingService : Service() {

  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private val handler = Handler(Looper.getMainLooper())
  private val autoStop = Runnable { stopRingingAndSelf() }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val taskId = intent?.getStringExtra(AlarmSchedulerModule.EXTRA_TASK_ID) ?: "alarm"
    val taskText = intent?.getStringExtra(AlarmSchedulerModule.EXTRA_TASK_TEXT) ?: ""
    val soundUri = intent?.getStringExtra(AlarmSchedulerModule.EXTRA_SOUND_URI)

    val notification = buildNotification(taskId, taskText)
    try {
      val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      } else {
        0
      }
      ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
    } catch (e: Exception) {
      // Still show the alarm so the user sees something, and keep trying to ring.
      Log.e(TAG, "startForeground failed: ${e.message}")
      notificationManager().notify(NOTIFICATION_ID, notification)
    }

    // A second start (e.g. JS asks to ring while the native alarm already rings)
    // must not restart the tone from the beginning or stack players.
    if (!isRinging) {
      isRinging = true
      acquireWakeLock()
      startSound(soundUri)
      startVibration()
    }
    handler.removeCallbacks(autoStop)
    handler.postDelayed(autoStop, MAX_RING_MS)
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    releaseEverything()
    super.onDestroy()
  }

  private fun stopRingingAndSelf() {
    releaseEverything()
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun releaseEverything() {
    handler.removeCallbacks(autoStop)
    try {
      player?.stop()
    } catch (_: Exception) {
    }
    player?.release()
    player = null
    vibrator?.cancel()
    vibrator = null
    if (wakeLock?.isHeld == true) wakeLock?.release()
    wakeLock = null
    isRinging = false
  }

  private fun startSound(soundUri: String?) {
    val candidates = mutableListOf<Uri>()
    if (!soundUri.isNullOrBlank()) candidates.add(Uri.parse(soundUri))
    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)?.let { candidates.add(it) }
    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)?.let { candidates.add(it) }

    for (uri in candidates) {
      val mp = MediaPlayer()
      try {
        mp.setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
        mp.setDataSource(this, uri)
        mp.isLooping = true
        mp.prepare()
        mp.start()
        player = mp
        Log.i(TAG, "ringing with $uri")
        return
      } catch (e: Exception) {
        Log.w(TAG, "could not play $uri: ${e.message}")
        mp.release()
      }
    }
    Log.e(TAG, "no playable alarm sound; vibration only")
  }

  @Suppress("DEPRECATION")
  private fun startVibration() {
    val v: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
    } else {
      getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }
    if (v == null || !v.hasVibrator()) return
    val pattern = longArrayOf(0, 800, 600)
    val alarmAttributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      v.vibrate(VibrationEffect.createWaveform(pattern, 0), alarmAttributes)
    } else {
      v.vibrate(pattern, 0)
    }
    vibrator = v
  }

  private fun acquireWakeLock() {
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MorningRitual:AlarmRing").apply {
      acquire(MAX_RING_MS + 5_000)
    }
  }

  private fun notificationManager(): NotificationManager =
    getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun buildNotification(taskId: String, taskText: String): Notification {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Shows while your alarm is ringing"
        // The service plays the sound and vibration itself.
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      notificationManager().createNotificationChannel(channel)
    }

    val openIntent = (packageManager.getLaunchIntentForPackage(packageName) ?: Intent())
      .apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        putExtra(AlarmSchedulerModule.EXTRA_FROM_ALARM, true)
        putExtra(AlarmSchedulerModule.EXTRA_TASK_ID, taskId)
      }
    val openPi = PendingIntent.getActivity(
      this, REQUEST_CODE_OPEN, openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val body = if (taskText.isBlank()) "Time for your morning ritual" else taskText
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle("Good morning. Your ritual is waiting")
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setFullScreenIntent(openPi, true)
      .setContentIntent(openPi)
      .setOngoing(true)
      .setAutoCancel(false)
      .setSilent(true)
      .build()
  }

  companion object {
    private const val TAG = "AlarmRingService"
    const val CHANNEL_ID = "morning-ritual-ringing"
    const val CHANNEL_NAME = "Alarm ringing"
    const val NOTIFICATION_ID = 2001
    private const val REQUEST_CODE_OPEN = 2002
    /** Safety net: stop ringing after 10 minutes even if nobody responds. */
    const val MAX_RING_MS = 10 * 60 * 1000L

    @Volatile
    @JvmStatic
    var isRinging: Boolean = false
      private set

    @JvmStatic
    fun start(context: Context, taskId: String, taskText: String, soundUri: String?) {
      val intent = Intent(context, AlarmRingService::class.java).apply {
        putExtra(AlarmSchedulerModule.EXTRA_TASK_ID, taskId)
        putExtra(AlarmSchedulerModule.EXTRA_TASK_TEXT, taskText)
        if (!soundUri.isNullOrBlank()) putExtra(AlarmSchedulerModule.EXTRA_SOUND_URI, soundUri)
      }
      ContextCompat.startForegroundService(context, intent)
    }

    /** stopService is allowed from the background, unlike startService. */
    @JvmStatic
    fun stop(context: Context) {
      context.stopService(Intent(context, AlarmRingService::class.java))
    }
  }
}
