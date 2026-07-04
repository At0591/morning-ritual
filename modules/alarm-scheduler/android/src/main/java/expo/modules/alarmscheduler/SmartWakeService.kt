package expo.modules.alarmscheduler

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlin.math.abs

class SmartWakeService : Service(), SensorEventListener {

    private lateinit var sensorManager: SensorManager
    private var accelerometer: Sensor? = null
    
    private var taskId: String? = null
    private var taskText: String? = null
    private var realTriggerMillis: Long = 0L

    private var isFired = false
    private val handler = Handler(Looper.getMainLooper())
    private val checkTimeRunnable = object : Runnable {
        override fun run() {
            if (System.currentTimeMillis() >= realTriggerMillis && !isFired) {
                fireAlarm("TIME_REACHED")
            } else {
                handler.postDelayed(this, 10000) // check every 10 seconds
            }
        }
    }

    // Basic movement threshold
    private var lastX: Float = 0f
    private var lastY: Float = 0f
    private var lastZ: Float = 0f
    private var lastUpdate: Long = 0
    private val SHAKE_THRESHOLD = 800

    override fun onCreate() {
        super.onCreate()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        taskId = intent?.getStringExtra(AlarmSchedulerModule.EXTRA_TASK_ID)
        taskText = intent?.getStringExtra(AlarmSchedulerModule.EXTRA_TASK_TEXT)
        realTriggerMillis = intent?.getLongExtra(AlarmSchedulerModule.EXTRA_REAL_TRIGGER_MILLIS, 0L) ?: 0L

        startForegroundServiceNotification()

        if (accelerometer != null) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_NORMAL)
        } else {
            // If no accelerometer, just wait for the time to pass
        }

        handler.postDelayed(checkTimeRunnable, 10000)

        return START_NOT_STICKY
    }

    private fun startForegroundServiceNotification() {
        val channelId = "smart-wake-service-channel"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Smart Wake Monitor",
                NotificationManager.IMPORTANCE_LOW // Low importance so it doesn't make sound
            )
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }

        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Morning Ritual: Smart Wake Active")
            .setContentText("Monitoring your sleep phase to wake you gently...")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()

        startForeground(1001, notification)
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || isFired) return

        val curTime = System.currentTimeMillis()
        if ((curTime - lastUpdate) > 100) {
            val diffTime = curTime - lastUpdate
            lastUpdate = curTime

            val x = event.values[0]
            val y = event.values[1]
            val z = event.values[2]

            val speed = abs(x + y + z - lastX - lastY - lastZ) / diffTime * 10000

            if (speed > SHAKE_THRESHOLD) {
                // Movement detected! Fire early!
                Log.i("SmartWakeService", "Movement threshold exceeded ($speed). Firing alarm early.")
                fireAlarm("MOVEMENT_DETECTED")
            }

            lastX = x
            lastY = y
            lastZ = z
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // No-op
    }

    private fun fireAlarm(reason: String) {
        if (isFired) return
        isFired = true

        sensorManager.unregisterListener(this)
        handler.removeCallbacks(checkTimeRunnable)

        val fireIntent = Intent(this, AlarmFireReceiver::class.java).apply {
            action = AlarmSchedulerModule.ACTION_FIRE
            putExtra(AlarmSchedulerModule.EXTRA_TASK_ID, taskId)
            putExtra(AlarmSchedulerModule.EXTRA_TASK_TEXT, taskText)
            putExtra(AlarmSchedulerModule.EXTRA_IS_PRE_WAKE, false)
        }
        sendBroadcast(fireIntent)

        stopSelf()
    }

    override fun onDestroy() {
        super.onDestroy()
        sensorManager.unregisterListener(this)
        handler.removeCallbacks(checkTimeRunnable)
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
