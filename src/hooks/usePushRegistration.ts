import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import {
  getAdminPushToken,
  initAdminNotifications,
  subscribeAdminTokenRefresh,
} from "../lib/notifications";

interface UsePushRegistrationResult {
  token: string | null;
  permissionGranted: boolean;
}

/**
 * Registers the device with Firebase Cloud Messaging on launch and
 * keeps a stable reference to the current FCM token. The token is
 * forwarded to the native app via the callback so it can be posted to
 * `/api/admin/mobile/push/register` with the mobile admin bearer token.
 *
 * Foreground messages are intentionally NOT handled here — they are
 * delivered by the native FCMService so that the OS draws the
 * lock-screen / heads-up notification regardless of JS state. The
 * native service is also the one that owns the notification channel.
 */
export function usePushRegistration(
  onToken: (token: string) => void,
): UsePushRegistrationResult {
  const [token, setToken] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const lastSentRef = useRef<string | null>(null);

  const handleToken = useCallback(
    (next: string | null) => {
      if (!next) return;
      setToken(next);
      if (lastSentRef.current === next) return;
      lastSentRef.current = next;
      onToken(next);
    },
    [onToken],
  );

  useEffect(() => {
    if (Platform.OS !== "android" && Platform.OS !== "ios") return;
    let isMounted = true;
    let unsub: (() => void) | null = null;

    void (async () => {
      try {
        // Permission + availability check. Firebase native code is only
        // touched here (inside a post-mount effect), never at import time,
        // and the wrapper can never throw — a missing/invalid Firebase
        // config returns { ok: false } instead of crashing the shell.
        const result = await initAdminNotifications();
        if (!isMounted) return;
        setPermissionGranted(result.ok);
        if (!result.ok) return;

        // Always pull the current token at launch — onTokenRefresh
        // may not fire if the native FCMService has overridden the
        // default intent (see android-fcm-lockscreen-alerts memory).
        const current = await getAdminPushToken();
        if (!isMounted) return;
        handleToken(current);

        unsub = await subscribeAdminTokenRefresh((next) => {
          if (isMounted) handleToken(next);
        });
        if (!isMounted && unsub) unsub();
      } catch {
        // Permission/setup errors must not crash the shell.
      }
    })();

    return () => {
      isMounted = false;
      if (unsub) unsub();
    };
  }, [handleToken]);

  return { token, permissionGranted };
}
