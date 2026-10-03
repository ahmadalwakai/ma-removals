import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

import { APP_LOCK_TIMEOUT_MS } from "../config";
import { type Language, uiText } from "../lib/i18n";

type LockState = "unknown" | "locked" | "unlocked";

interface UseAppLockResult {
  state: LockState;
  authenticate: () => Promise<boolean>;
  /** Force the lock back on (e.g. from a JS bridge `lock` command). */
  lock: () => void;
}

/**
 * Biometric / device-credential app lock.
 *
 * - On first launch the user is prompted for biometrics (or PIN/pattern).
 * - The app is re-locked when it has been backgrounded for longer than
 *   `APP_LOCK_TIMEOUT_MS`, or whenever `lock()` is called.
 * - If the device has no enrolled biometrics/credentials the lock is
 *   bypassed (so the app remains usable for staff on shared hardware
 *   before they enrol a fingerprint).
 */
export function useAppLock(language: Language): UseAppLockResult {
  const [state, setState] = useState<LockState>("unknown");
  const lastBackgroundedAt = useRef<number | null>(null);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "android" && Platform.OS !== "ios") {
      setState("unlocked");
      return true;
    }
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        setState("unlocked");
        return true;
      }
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: uiText(language, "Unlock M&A Admin", "فتح إدارة M&A"),
        fallbackLabel: uiText(language, "Use device passcode", "استخدم رمز الجهاز"),
        disableDeviceFallback: false,
        cancelLabel: uiText(language, "Cancel", "إلغاء"),
      });
      if (res.success) {
        setState("unlocked");
        return true;
      }
      setState("locked");
      return false;
    } catch {
      // Any unexpected biometric failure should not brick the shell.
      setState("unlocked");
      return true;
    }
  }, [language]);

  const lock = useCallback(() => {
    setState("locked");
  }, []);

  // Initial unlock attempt.
  useEffect(() => {
    void authenticate();
  }, [authenticate]);

  // Auto-lock when the app has been in the background long enough.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background" || next === "inactive") {
        lastBackgroundedAt.current = Date.now();
        return;
      }
      if (next === "active" && lastBackgroundedAt.current != null) {
        const elapsed = Date.now() - lastBackgroundedAt.current;
        lastBackgroundedAt.current = null;
        if (elapsed >= APP_LOCK_TIMEOUT_MS) {
          setState("locked");
        }
      }
    });
    return () => sub.remove();
  }, []);

  return { state, authenticate, lock };
}
