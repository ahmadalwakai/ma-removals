import { useEffect, useRef } from "react";
import {
  BackHandler,
  Platform,
  ToastAndroid,
  type NativeEventSubscription,
} from "react-native";

/**
 * Android-only: when the WebView cannot go back, intercept the hardware
 * back button. Show a toast on first press, exit on a second press within
 * `windowMs`. Mirrors standard Play Store app behaviour and prevents
 * dispatchers from accidentally killing the app mid-shift.
 */
export function useDoubleBackToExit(
  canGoBackRef: { current: boolean },
  goBack: () => void,
  windowMs: number = 2000,
): void {
  const lastPressAt = useRef<number>(0);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub: NativeEventSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (canGoBackRef.current) {
          goBack();
          return true;
        }
        const now = Date.now();
        if (now - lastPressAt.current < windowMs) {
          return false; // let the OS exit the app
        }
        lastPressAt.current = now;
        ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
        return true;
      },
    );
    return () => sub.remove();
  }, [canGoBackRef, goBack, windowMs]);
}
