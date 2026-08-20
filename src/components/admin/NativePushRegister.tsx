"use client";

import { useEffect } from "react";

interface NativeEvent {
  type: string;
  token?: string;
  platform?: string;
  appVersion?: string;
  deviceModel?: string;
}

interface NativeBridge {
  platform?: string;
  version?: string;
  onEvent?: (fn: (evt: NativeEvent) => void) => () => void;
}

declare global {
  interface Window {
    MARemovalsNative?: NativeBridge;
  }
}

/**
 * Listens for `push-token` events emitted by the native admin shell
 * (see ma-removals-admin-android/src/screens/AdminApp.tsx) and posts
 * them to `/api/admin/push/register`. The endpoint is authenticated
 * with the existing NextAuth session cookie, so no extra credentials
 * need to round-trip through the bridge.
 *
 * Renders nothing — pure side-effect component.
 */
export function NativePushRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const bridge = window.MARemovalsNative;
    if (!bridge?.onEvent) return;

    let lastRegistered: string | null = null;

    const unsubscribe = bridge.onEvent(async (evt) => {
      if (evt?.type !== "push-token") return;
      const token = typeof evt.token === "string" ? evt.token : "";
      if (!token || token === lastRegistered) return;
      lastRegistered = token;
      try {
        const res = await fetch("/api/admin/push/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            platform: evt.platform ?? bridge.platform ?? "android",
            appVersion: evt.appVersion ?? bridge.version,
            deviceModel: evt.deviceModel,
          }),
          credentials: "include",
        });
        if (!res.ok) {
          // Reset so we retry the next time the bridge fires.
          lastRegistered = null;
        }
      } catch {
        lastRegistered = null;
      }
    });

    return () => {
      try { unsubscribe(); } catch { /* noop */ }
    };
  }, []);

  return null;
}
