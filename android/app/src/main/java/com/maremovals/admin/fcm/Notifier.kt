package com.maremovals.admin.fcm

import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat

import com.maremovals.admin.MainActivity
import com.maremovals.admin.R

/**
 * Builds the notification channel + heads-up / lock-screen notifications
 * shown by FCMService. Mirrors the approach documented in the
 * `android-fcm-lockscreen-alerts` memory note: HIGH importance channel,
 * CATEGORY_CALL, full-screen intent.
 */
internal object Notifier {

  const val CHANNEL_ID = "ma-admin-critical-alerts-v2"
  private const val CHANNEL_NAME = "Critical admin alerts"
  private const val CHANNEL_DESC = "New bookings, driver SOS, chat replies with lock-screen sound"

  fun alertSoundUri(context: Context): Uri =
    Uri.parse("android.resource://${context.packageName}/${R.raw.universfield_ringtone_052_494940}")

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    try {
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (nm.getNotificationChannel(CHANNEL_ID) != null) return

      val attrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      val channel = NotificationChannel(
        CHANNEL_ID,
        CHANNEL_NAME,
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = CHANNEL_DESC
        enableLights(true)
        enableVibration(true)
        lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC

        try {
          setBypassDnd(true)
        } catch (t: Throwable) {
          Log.w(TAG, "DND bypass was not allowed for alert channel", t)
        }

        try {
          setSound(alertSoundUri(context), attrs)
        } catch (t: Throwable) {
          Log.w(TAG, "Custom alert sound could not be attached to channel", t)
        }
      }
      nm.createNotificationChannel(channel)
    } catch (t: Throwable) {
      Log.w(TAG, "Alert notification channel setup failed", t)
    }
  }

  fun show(
    context: Context,
    title: String,
    body: String,
    deeplink: String?,
    notificationId: Int,
  ) {
    ensureChannel(context)

    val tapIntent = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      if (!deeplink.isNullOrBlank()) {
        putExtra(EXTRA_DEEPLINK, deeplink)
        data = Uri.parse("maremovalsadmin://route?to=" + Uri.encode(deeplink))
      }
    }
    val tapPi = PendingIntent.getActivity(
      context,
      notificationId,
      tapIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    // Full-screen intent: launches the LockscreenAlertActivity over the
    // keyguard. Without this the OS cannot show a heads-up over a locked
    // device for data-only messages.
    val fullScreenIntent = Intent(context, LockscreenAlertActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra(EXTRA_TITLE, title)
      putExtra(EXTRA_BODY, body)
      if (!deeplink.isNullOrBlank()) putExtra(EXTRA_DEEPLINK, deeplink)
    }
    val fullScreenPi = PendingIntent.getActivity(
      context,
      notificationId + 1,
      fullScreenIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .setContentIntent(tapPi)
      .setFullScreenIntent(fullScreenPi, true)
      .setSound(alertSoundUri(context))
      .setVibrate(longArrayOf(0, 550, 300, 550, 300, 900))
      .setDefaults(NotificationCompat.DEFAULT_LIGHTS)

    try {
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.notify(notificationId, builder.build())
    } catch (t: Throwable) {
      Log.w(TAG, "Alert notification display failed", t)
    }

    // OEM reliability: setFullScreenIntent silently degrades to a heads-up
    // (no Activity launch over the keyguard) on Samsung One UI / Xiaomi MIUI
    // and on Android 14+ where USE_FULL_SCREEN_INTENT is denied by default.
    // A high-priority FCM data message grants a brief background-activity-start
    // (BAL) window, so when the device is locked or the screen is off we also
    // launch the alert Activity directly. The Activity is singleInstance so it
    // never double-stacks with an OS-honoured full-screen intent.
    if (isLockedOrScreenOff(context)) {
      try {
        context.startActivity(fullScreenIntent)
      } catch (e: Throwable) {
        Log.w(TAG, "Direct lock-screen Activity launch failed", e)
      }
    }
  }

  private fun isLockedOrScreenOff(context: Context): Boolean {
    return try {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      val km = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
      val interactive: Boolean = pm.isInteractive
      val locked: Boolean = km.isKeyguardLocked
      !interactive || locked
    } catch (e: Throwable) {
      false
    }
  }

  private const val TAG = "MA.Notifier"

  const val EXTRA_TITLE = "ma_title"
  const val EXTRA_BODY = "ma_body"
  const val EXTRA_DEEPLINK = "ma_deeplink"
}
