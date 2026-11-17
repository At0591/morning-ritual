package expo.modules.alarmscheduler

import android.app.Activity
import android.content.Context
import android.os.Bundle
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/**
 * Hooks the app's activity at creation time (Expo autolinking picks up any
 * *Package.kt that imports expo.modules.core.interfaces.Package).
 *
 * When the ringing alarm opens the app while the phone is locked, the activity
 * is created behind the lock screen and never resumes, so a show-when-locked
 * flag set on resume would come too late. Setting it in onCreate lets the
 * wake-up screen appear over the lock screen and turn the screen on.
 */
class AlarmSchedulerPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> =
    listOf(object : ReactActivityLifecycleListener {
      override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
        if (activity.intent?.getBooleanExtra(AlarmSchedulerModule.EXTRA_FROM_ALARM, false) == true) {
          AlarmSchedulerModule.applyShowWhenLocked(activity, true)
        }
      }
    })
}
