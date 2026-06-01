import { useCallback, useEffect, useState } from "react";
import { AppState, NativeModules, Platform } from "react-native";

interface MAAdminIntentsNative {
  canUseFullScreenIntent?: () => boolean;
  isIgnoringBatteryOptimizations?: () => boolean;
  openFullScreenIntentSettings?: () => void;
  requestIgnoreBatteryOptimizations?: () => void;
}

const native = NativeModules.MAAdminIntents as MAAdminIntentsNative | undefined;

export interface PermissionGateState {
  /** True until the first native check has run. */
  checking: boolean;
  /** Android 14+ full-screen-intent permission (true on older OS). */
  fullScreenIntent: boolean;
  /** Battery-optimisation (Doze) exemption. */
  batteryUnrestricted: boolean;
  /** True when every required permission is granted. */
  allGranted: boolean;
  /** Re-read the native permission state. */
  refresh: () => void;
  /** Open the system "Full screen intents" settings screen. */
  openFullScreenIntentSettings: () => void;
  /** Prompt for the battery-optimisation exemption. */
  requestBatteryExemption: () => void;
}

/**
 * Tracks the two OS grants the native lock-screen alert depends on:
 *  - USE_FULL_SCREEN_INTENT (denied by default for non-call apps on
 *    Android 14+), and
 *  - battery-optimisation exemption (so Doze never freezes the
 *    KeepAliveService / FCM delivery).
 *
 * Re-checks whenever the app returns to the foreground so the gate
 * closes itself as soon as the user grants from system settings.
 */
export function usePermissionGate(): PermissionGateState {
  const isAndroid = Platform.OS === "android";
  const [checking, setChecking] = useState(isAndroid);
  const [fullScreenIntent, setFullScreenIntent] = useState(true);
  const [batteryUnrestricted, setBatteryUnrestricted] = useState(true);

  const refresh = useCallback(() => {
    if (!isAndroid || !native) {
      setChecking(false);
      return;
    }
    try {
      setFullScreenIntent(native.canUseFullScreenIntent?.() ?? true);
      setBatteryUnrestricted(native.isIgnoringBatteryOptimizations?.() ?? true);
    } catch {
      // Fail open so a native error never blocks access to the console.
      setFullScreenIntent(true);
      setBatteryUnrestricted(true);
    } finally {
      setChecking(false);
    }
  }, [isAndroid]);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const openFullScreenIntentSettings = useCallback(() => {
    native?.openFullScreenIntentSettings?.();
  }, []);

  const requestBatteryExemption = useCallback(() => {
    native?.requestIgnoreBatteryOptimizations?.();
  }, []);

  return {
    checking,
    fullScreenIntent,
    batteryUnrestricted,
    allGranted: fullScreenIntent && batteryUnrestricted,
    refresh,
    openFullScreenIntentSettings,
    requestBatteryExemption,
  };
}
