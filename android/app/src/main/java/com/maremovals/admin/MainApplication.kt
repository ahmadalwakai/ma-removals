package com.maremovals.admin

import android.app.Application
import android.content.res.Configuration
import android.util.Log

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import com.maremovals.admin.fcm.MAAdminIntentsPackage
import com.maremovals.admin.fcm.Notifier

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(MAAdminIntentsPackage())
        }
    )
  }

  override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)

    // Make sure the notification channels are ready before any FCM payload
    // arrives. The keep-alive foreground service is intentionally NOT started
    // here: promoting a `remoteMessaging` foreground service from
    // Application.onCreate (before any Activity is resumed) is disallowed on
    // Android 12+ and throws inside startForeground(), crashing the process.
    // MainActivity.onResume starts it once the app is genuinely foreground.
    try {
      Notifier.ensureChannel(this)
    } catch (t: Throwable) {
      Log.w("MA.MainApplication", "Notification channel setup failed during app startup", t)
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
