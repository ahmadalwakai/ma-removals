import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, NativeModules, Platform } from "react-native";
import * as ExpoLinking from "expo-linking";

/**
 * Resolves the initial deep-link URL when the app is launched from a
 * notification, push intent or `maremovalsadmin://` link. Returns
 * `null` until the URL is known (or none was provided), so the caller
 * can fall back to ADMIN_URL.
 *
 * Sources, in order of precedence:
 *  1. Native intent extra `deeplink` set by FCMService when the user
 *     taps a heads-up notification (see Notifier.kt).
 *  2. `ExpoLinking.getInitialURL()` — for `maremovalsadmin://...`
 *     scheme handoffs.
 *  3. `Linking.addEventListener("url", ...)` — when a deep-link
 *     arrives while the app is already running.
 */
export function useDeepLink() {
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const consumedInitialRef = useRef(false);

  const normalise = useCallback((raw: string | null): string | null => {
    if (!raw) return null;
    // Drop scheme: maremovalsadmin://bookings/123 -> /bookings/123
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === "maremovalsadmin:") {
        return (parsed.pathname || "/") + (parsed.search ?? "");
      }
      // Already an HTTPS admin URL — pass through unchanged.
      return raw;
    } catch {
      // Caller passed a path directly.
      return raw.startsWith("/") ? raw : `/${raw}`;
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android" && Platform.OS !== "ios") return;
    let cancelled = false;

    (async () => {
      try {
        // 1) Native intent extra (FCM tap).
        const intentExtra =
          (NativeModules.MAAdminIntents?.getDeeplinkExtra?.() as
            | string
            | null
            | undefined) ?? null;
        if (intentExtra && !cancelled) {
          setPendingPath(normalise(intentExtra));
          consumedInitialRef.current = true;
          return;
        }
        // 2) Initial scheme URL.
        const initial = await ExpoLinking.getInitialURL();
        if (initial && !cancelled) {
          setPendingPath(normalise(initial));
          consumedInitialRef.current = true;
        }
      } catch {
        /* noop */
      }
    })();

    // 3) Live deep-link events while the app is running.
    const sub = Linking.addEventListener("url", (e: { url: string }) => {
      setPendingPath(normalise(e.url));
    });

    // 4) On every foreground transition, re-check the native intent
    //    extra — FCM may have replaced it with a fresh booking ref.
    const appSub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      const extra =
        (NativeModules.MAAdminIntents?.getDeeplinkExtra?.() as
          | string
          | null
          | undefined) ?? null;
      if (extra) setPendingPath(normalise(extra));
    });

    return () => {
      cancelled = true;
      sub.remove();
      appSub.remove();
    };
  }, [normalise]);

  const consume = useCallback(() => setPendingPath(null), []);

  return { pendingPath, consume };
}
