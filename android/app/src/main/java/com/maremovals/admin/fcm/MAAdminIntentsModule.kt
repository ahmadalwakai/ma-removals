package com.maremovals.admin.fcm

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

import com.maremovals.admin.MainActivity

/**
 * Exposes the launch-time deep-link extra (set by a notification tap)
 * to React Native via `NativeModules.MAAdminIntents.getDeeplinkExtra()`.
 *
 * The extra is consumed on read so each link is only routed once.
 *
 * Also exposes the Android 14+ full-screen-intent + battery-optimisation
 * permission state and the corresponding system settings screens so the
 * JS PermissionGate can force the admin to grant them. Without these the
 * lock-screen alert is unreliable on Android 14+ / aggressive OEMs.
 */
class MAAdminIntentsModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "MAAdminIntents"

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun getDeeplinkExtra(): String? {
    return MainActivity.consumePendingDeeplink()
  }

  /**
   * Whether the app may post full-screen-intent notifications. Always
   * true below Android 14 (the permission is granted implicitly).
   */
  @ReactMethod(isBlockingSynchronousMethod = true)
  fun canUseFullScreenIntent(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true
    return try {
      val nm = reactApplicationContext
        .getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.canUseFullScreenIntent()
    } catch (_: Throwable) {
      false
    }
  }

  /** Whether the app is exempt from battery optimisation (Doze). */
  @ReactMethod(isBlockingSynchronousMethod = true)
  fun isIgnoringBatteryOptimizations(): Boolean {
    return try {
      val pm = reactApplicationContext
        .getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(reactApplicationContext.packageName)
    } catch (_: Throwable) {
      true
    }
  }

  /** Opens the system "Full screen intents" settings screen (Android 14+). */
  @ReactMethod
  fun openFullScreenIntentSettings() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return
    try {
      val intent = Intent(
        Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
        Uri.parse("package:" + reactApplicationContext.packageName),
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
    } catch (_: Throwable) {
      openAppDetailsSettings()
    }
  }

  /** Prompts the user to exempt the app from battery optimisation. */
  @ReactMethod
  fun requestIgnoreBatteryOptimizations() {
    try {
      @android.annotation.SuppressLint("BatteryLife")
      val intent = Intent(
        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
        Uri.parse("package:" + reactApplicationContext.packageName),
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
    } catch (_: Throwable) {
      openAppDetailsSettings()
    }
  }

  private fun openAppDetailsSettings() {
    try {
      val intent = Intent(
        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
        Uri.parse("package:" + reactApplicationContext.packageName),
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
    } catch (_: Throwable) {
      /* noop */
    }
  }
}
