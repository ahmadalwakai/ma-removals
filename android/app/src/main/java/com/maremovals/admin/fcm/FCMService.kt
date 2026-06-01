package com.maremovals.admin.fcm

import android.util.Log

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Native FCM handler. Receives data-only messages from the M&A
 * Removals server and renders a HIGH-importance heads-up notification
 * with a full-screen intent so it pops over the lock screen even when
 * the JS engine is asleep.
 *
 * Server contract (see ma-removals/src/lib/fcm.ts):
 *   data = {
 *     "title":    "New booking #ABC-123",
 *     "body":     "Anna J. — Kingston KT1 → Wimbledon SW19",
 *     "deeplink": "/admin/bookings/abc123",        // optional
 *     "type":     "new_booking",                   // optional
 *     "ref":      "ABC-123"                        // optional
 *   }
 *
 * Tokens are pushed back to JS via onTokenRefresh in @react-native-firebase/messaging
 * (we DO NOT call /api/admin/push/register from native — the WebView
 * session cookie lives in the WebView, not the OS HTTP stack).
 */
class FCMService : FirebaseMessagingService() {

  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val data = remoteMessage.data
    val notif = remoteMessage.notification

    val title = data["title"] ?: notif?.title ?: "M&A Admin"
    val body = data["body"] ?: notif?.body ?: ""
    val deeplink = data["deeplink"]

    if (body.isBlank() && title == "M&A Admin") {
      Log.d(TAG, "Empty FCM payload received, ignoring")
      return
    }

    Notifier.show(
      context = applicationContext,
      title = title,
      body = body,
      deeplink = deeplink,
      notificationId = data["ref"]?.hashCode() ?: System.currentTimeMillis().toInt(),
    )
  }

  override fun onNewToken(token: String) {
    // The JS layer pulls the latest token via getToken() on every
    // launch (see usePushRegistration), so we don't need to broadcast
    // here. Log only for diagnostics.
    Log.d(TAG, "FCM token refreshed (length=${token.length})")
  }

  companion object {
    private const val TAG = "MA.FCMService"
  }
}
