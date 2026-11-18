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
import android.provider.Settings
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

  // Gentle start: the tone begins quiet and rises to full over RAMP_MS.
  // While the user does the wake check it drops to a whisper (quiet mode).
  private var volume = START_VOLUME
  private var quiet = false
  private val rampStep = object : Runnable {
    override fun run() {
      if (quiet) return
      volume = (volume + RAMP_INCREMENT).coerceAtMost(1f)
      applyVolume(volume)
      if (volume < 1f) handler.postDelayed(this, RAMP_TICK_MS)
    }
  }

  override fun onCreate() {
    super.onCreate()
    instance = this
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun applyVolume(v: Float) {
    try {
      player?.setVolume(v, v)
    } catch (_: Exception) {
    }
  }

  /** Quiet while the wake check is on screen; back to rising if it's left alone. */
  fun applyQuiet(on: Boolean) {
    handler.post {
      if (!isRinging || quiet == on) return@post
      quiet = on
      handler.removeCallbacks(rampStep)
      if (on) {
        applyVolume(QUIET_VOLUME)
        vibrator?.cancel()
        vibrator = null
      } else {
        applyVolume(volume)
        startVibration()
        if (volume < 1f) handler.postDelayed(rampStep, RAMP_TICK_MS)
      }
    }
  }

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
      openWakeScreenIfAllowed(taskId)
    }
    handler.removeCallbacks(autoStop)
    handler.postDelayed(autoStop, MAX_RING_MS)
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    releaseEverything()
    if (instance === this) instance = null
    super.onDestroy()
  }

  private fun stopRingingAndSelf() {
    releaseEverything()
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun releaseEverything() {
    handler.removeCallbacks(autoStop)
    handler.removeCallbacks(rampStep)
    quiet = false
    volume = START_VOLUME
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
        volume = START_VOLUME
        mp.setVolume(volume, volume)
        mp.start()
        player = mp
        handler.removeCallbacks(rampStep)
        handler.postDelayed(rampStep, RAMP_TICK_MS)
        Log.i(TAG, "ringing with $uri (rising from $START_VOLUME over ${RAMP_MS / 1000}s)")
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

  /**
   * Backup for skins (OriginOS, MIUI) that reject full-screen intents even
   * when the user allowed them: with "Display over other apps" an app may
   * start an activity from the background, so open the wake-up screen
   * directly. AlarmSchedulerPackage makes it show over the lock screen.
   */
  private fun openWakeScreenIfAllowed(taskId: String) {
    if (!Settings.canDrawOverlays(this)) return
    try {
      startActivity(buildOpenIntent(taskId))
      Log.i(TAG, "opened wake screen directly")
    } catch (e: Exception) {
      Log.w(TAG, "could not open wake screen directly: ${e.message}")
    }
  }

  private fun buildOpenIntent(taskId: String): Intent =
    (packageManager.getLaunchIntentForPackage(packageName) ?: Intent())
      .apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        putExtra(AlarmSchedulerModule.EXTRA_FROM_ALARM, true)
        putExtra(AlarmSchedulerModule.EXTRA_TASK_ID, taskId)
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

    val openPi = PendingIntent.getActivity(
      this, REQUEST_CODE_OPEN, buildOpenIntent(taskId),
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

    // Gentle start: 15% of the alarm volume, rising to 100% over 30 seconds.
    private const val START_VOLUME = 0.15f
    private const val QUIET_VOLUME = 0.06f
    private const val RAMP_MS = 30_000L
    private const val RAMP_TICK_MS = 1_000L
    private const val RAMP_INCREMENT = (1f - START_VOLUME) / (RAMP_MS / RAMP_TICK_MS)

    @Volatile
    private var instance: AlarmRingService? = null

    /** Drop to a whisper while the wake check is on screen (or undo it). */
    @JvmStatic
    fun setQuiet(on: Boolean) {
      instance?.applyQuiet(on)
    }

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
