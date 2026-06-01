package com.maremovals.admin.fcm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

import androidx.core.app.NotificationCompat

import com.maremovals.admin.MainActivity
import com.maremovals.admin.R

/**
 * Sticky foreground service whose only job is to keep the process
 * alive so the OS keeps delivering FCM data messages to FCMService
 * when the user has backgrounded the app on Android 14+.
 *
 * Without `FOREGROUND_SERVICE_REMOTE_MESSAGING` + a running service of
 * type `remoteMessaging`, Doze freezes the process within minutes and
 * silent FCM payloads never reach Notifier.show (documented in the
 * android-fcm-lockscreen-alerts memory note).
 */
class KeepAliveService : Service() {

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    ensureChannel()
    startInForeground()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startInForeground()
    return START_STICKY
  }

  private fun startInForeground() {
    val tapIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val tapPi = PendingIntent.getActivity(
      this,
      0,
      tapIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notification = NotificationCompat.Builder(this, KEEPALIVE_CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle("M&A Admin")
      .setContentText("Listening for new bookings & alerts")
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .setVisibility(NotificationCompat.VISIBILITY_SECRET)
      .setContentIntent(tapPi)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        KEEPALIVE_NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING,
      )
    } else {
      startForeground(KEEPALIVE_NOTIFICATION_ID, notification)
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(KEEPALIVE_CHANNEL_ID) != null) return
    val ch = NotificationChannel(
      KEEPALIVE_CHANNEL_ID,
      "Background service",
      NotificationManager.IMPORTANCE_MIN,
    ).apply {
      description = "Keeps push notifications working when the app is closed."
      setShowBadge(false)
      lockscreenVisibility = NotificationCompat.VISIBILITY_SECRET
      enableVibration(false)
      enableLights(false)
      setSound(null, null)
    }
    nm.createNotificationChannel(ch)
  }

  companion object {
    const val KEEPALIVE_CHANNEL_ID = "ma-admin-keepalive"
    private const val KEEPALIVE_NOTIFICATION_ID = 4242

    fun start(context: Context) {
      val intent = Intent(context, KeepAliveService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }
  }
}
