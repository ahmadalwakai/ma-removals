package com.maremovals.admin.fcm

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

import com.maremovals.admin.MainActivity

/**
 * Translucent activity shown by [Notifier]'s full-screen intent. It
 * wakes the screen and dismisses the keyguard so an admin sees the
 * alert immediately, even when the phone is locked.
 *
 * Layout is built in code so no XML resource needs to ship.
 */
class LockscreenAlertActivity : Activity() {

  private var wakeLock: PowerManager.WakeLock? = null
  private var ringtone: Ringtone? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // setShowWhenLocked + setTurnScreenOn alone do NOT power a fully-off
    // screen back on from a background launch on many OEMs. Acquire a
    // temporary full wake lock (auto-released after 60s) to force the
    // display on. Requires the WAKE_LOCK permission.
    acquireWakeLock()

    // Show over keyguard + turn the screen on.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
      km.requestDismissKeyguard(this, null)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      )
    }

    val title = intent.getStringExtra(Notifier.EXTRA_TITLE) ?: "M&A Admin"
    val body = intent.getStringExtra(Notifier.EXTRA_BODY) ?: ""
    val deeplink = intent.getStringExtra(Notifier.EXTRA_DEEPLINK)

    val pad = (resources.displayMetrics.density * 24).toInt()
    val container = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.WHITE)
      setPadding(pad, pad, pad, pad)
    }

    container.addView(TextView(this).apply {
      text = title
      textSize = 22f
      setTextColor(Color.parseColor("#0F172A"))
      gravity = Gravity.CENTER
    })
    container.addView(TextView(this).apply {
      text = body
      textSize = 16f
      setTextColor(Color.parseColor("#334155"))
      gravity = Gravity.CENTER
      val topMargin = (resources.displayMetrics.density * 12).toInt()
      val lp = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      )
      lp.topMargin = topMargin
      layoutParams = lp
    })

    val buttonRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      val topMargin = (resources.displayMetrics.density * 32).toInt()
      val lp = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      )
      lp.topMargin = topMargin
      layoutParams = lp
    }
    buttonRow.addView(buildButton("Dismiss", Color.parseColor("#E2E8F0"), Color.parseColor("#0F172A")) {
      finish()
    })
    buttonRow.addView(View(this).apply {
      val gap = (resources.displayMetrics.density * 12).toInt()
      layoutParams = LinearLayout.LayoutParams(gap, 1)
    })
    buttonRow.addView(buildButton("Open booking", Color.parseColor("#2563EB"), Color.WHITE) {
      val open = Intent(this, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        if (!deeplink.isNullOrBlank()) putExtra(Notifier.EXTRA_DEEPLINK, deeplink)
      }
      startActivity(open)
      finish()
    })
    container.addView(buttonRow)

    setContentView(container)

    startAlertSignals()
  }

  override fun onDestroy() {
    stopAlertSignals()
    super.onDestroy()
  }

  private fun acquireWakeLock() {
    try {
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      @Suppress("DEPRECATION")
      val lock = pm.newWakeLock(
        PowerManager.FULL_WAKE_LOCK or
          PowerManager.ACQUIRE_CAUSES_WAKEUP or
          PowerManager.ON_AFTER_RELEASE,
        "MAAdmin:LockscreenAlert",
      )
      lock.acquire(60_000L) // safety timeout — released in stopAlertSignals
      wakeLock = lock
    } catch (_: Throwable) {
      // WakeLock is best-effort; the activity still shows without it.
    }
  }

  private fun startAlertSignals() {
    try {
      val uri = Notifier.alertSoundUri(this)
      val rt = RingtoneManager.getRingtone(applicationContext, uri)
      if (rt != null) {
        val attrs = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
        rt.audioAttributes = attrs
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) rt.isLooping = true
        rt.play()
        ringtone = rt
      }
    } catch (_: Throwable) {
      // Sound is best-effort.
    }
    try {
      val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
      val pattern = longArrayOf(0, 500, 500)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0))
      } else {
        @Suppress("DEPRECATION")
        vibrator.vibrate(pattern, 0)
      }
    } catch (_: Throwable) {
      // Vibration is best-effort.
    }
  }

  private fun stopAlertSignals() {
    try {
      ringtone?.stop()
    } catch (_: Throwable) { /* noop */ }
    ringtone = null
    try {
      val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
      vibrator.cancel()
    } catch (_: Throwable) { /* noop */ }
    try {
      wakeLock?.let { if (it.isHeld) it.release() }
    } catch (_: Throwable) { /* noop */ }
    wakeLock = null
  }

  private fun buildButton(label: String, bg: Int, fg: Int, onClick: () -> Unit): Button {
    return Button(this).apply {
      text = label
      setTextColor(fg)
      setBackgroundColor(bg)
      val padH = (resources.displayMetrics.density * 24).toInt()
      val padV = (resources.displayMetrics.density * 10).toInt()
      setPadding(padH, padV, padH, padV)
      setOnClickListener { onClick() }
    }
  }
}
