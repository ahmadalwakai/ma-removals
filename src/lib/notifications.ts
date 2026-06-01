import { Platform } from "react-native";

/**
 * Safe Firebase Cloud Messaging wrapper for the admin shell.
 *
 * Design rules (see the `android-fcm-lockscreen-alerts` memory note):
 *  - NOTHING in this module touches native Firebase at import time. The
 *    `@react-native-firebase/messaging` module is pulled in lazily with a
 *    dynamic `import()` only when a function is actually called, and only
 *    after the first screen has mounted. This guarantees no native FCM /
 *    `messaging()` call can run during app startup / render.
 *  - Every exported function is fully wrapped in try/catch and can NEVER
 *    throw. When Firebase is missing, misconfigured (no `google_app_id`
 *    resource in the APK) or otherwise unsupported, the caller gets a
 *    controlled result object / `null` instead of a crash.
 *
 * The native `FCMService` owns the actual notification UI (lock-screen /
 * heads-up). This module only handles permission + token plumbing so the
 * web admin can register the device.
 */

export type NotificationInitResult = {
  /** True when permission was granted and messaging is usable. */
  ok: boolean;
  /**
   * Machine-readable reason when `ok` is false. One of:
   *  - "unsupported-platform"
   *  - "module-unavailable"
   *  - "permission-denied"
   *  - "init-failed"
   */
  reason?: string;
};

type MessagingModule = typeof import("@react-native-firebase/messaging");
type MessagingFactory = MessagingModule["default"];

let cachedToken: string | null = null;

function isNativeMobile(): boolean {
  return Platform.OS === "android" || Platform.OS === "ios";
}

/**
 * Lazily resolve the messaging factory. Returns null (never throws) when the
 * native module is absent or fails to load — e.g. when running on web, in
 * Expo Go, or in an APK that was built without valid Firebase resources.
 */
async function loadMessaging(): Promise<MessagingFactory | null> {
  if (!isNativeMobile()) return null;
  try {
    const mod = (await import(
      "@react-native-firebase/messaging"
    )) as MessagingModule;
    return mod?.default ?? null;
  } catch {
    return null;
  }
}

/**
 * Request notification permission and confirm messaging is available.
 * Must be called from a `useEffect` AFTER the first screen mounts — never
 * during render or at module scope.
 */
export async function initAdminNotifications(): Promise<NotificationInitResult> {
  if (!isNativeMobile()) {
    return { ok: false, reason: "unsupported-platform" };
  }

  try {
    const messaging = await loadMessaging();
    if (!messaging) {
      return { ok: false, reason: "module-unavailable" };
    }

    const status = await messaging().requestPermission({
      alert: true,
      badge: true,
      sound: true,
    });

    const granted =
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL;

    return granted ? { ok: true } : { ok: false, reason: "permission-denied" };
  } catch {
    // A missing `google_app_id` resource surfaces here as
    // "Default FirebaseApp is not initialized" — swallow it so the shell
    // keeps running without notifications instead of crashing.
    return { ok: false, reason: "init-failed" };
  }
}

/**
 * Resolve the current FCM registration token, or null when unavailable.
 * Never throws.
 */
export async function getAdminPushToken(): Promise<string | null> {
  if (!isNativeMobile()) return null;

  try {
    const messaging = await loadMessaging();
    if (!messaging) return null;
    const token = await messaging().getToken();
    cachedToken = token ?? null;
    return cachedToken;
  } catch {
    return null;
  }
}

/**
 * Subscribe to FCM token rotation. Returns an unsubscribe function. When
 * messaging is unavailable the returned unsubscribe is a no-op. Never throws.
 */
export async function subscribeAdminTokenRefresh(
  onToken: (token: string) => void,
): Promise<() => void> {
  if (!isNativeMobile()) return () => {};

  try {
    const messaging = await loadMessaging();
    if (!messaging) return () => {};
    const unsub = messaging().onTokenRefresh((next: string) => {
      if (!next) return;
      cachedToken = next;
      try {
        onToken(next);
      } catch {
        /* listener errors must not propagate */
      }
    });
    return () => {
      try {
        unsub();
      } catch {
        /* noop */
      }
    };
  } catch {
    return () => {};
  }
}
