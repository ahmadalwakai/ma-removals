import Constants from "expo-constants";

/**
 * The one and only production admin dashboard the APK is allowed to open.
 * The native shell is a thin WebView wrapper around this URL.
 */
export const PRODUCTION_ADMIN_URL = "https://maremovals.com/admin";

/** Host of the production URL — used to derive the WebView allow-list. */
export const PRODUCTION_ADMIN_HOST = "maremovals.com";

type Extra = {
  adminUrl?: string;
};

/**
 * Substrings / shapes that must NEVER be the active WebView URL in a shipped
 * APK. They all point at a developer machine and are unreachable from a real
 * Android device:
 *
 *  - `localhost` / `127.0.0.1` resolve to the *phone itself*, not your PC, so
 *    the WebView loads nothing and the screen hangs or crashes.
 *  - `10.0.2.2` is the Android *emulator* alias for the host loopback — it is
 *    meaningless on physical hardware.
 *  - `192.168.*` / `172.*` LAN IPs only work while the phone is on the same
 *    Wi-Fi as the dev server and the server is running — never in production.
 *  - Plain `http://` is cleartext; production must be HTTPS only.
 */
function isUnsafeUrl(url: string): boolean {
  const value = url.trim().toLowerCase();
  return (
    value.includes("localhost") ||
    value.includes("127.0.0.1") ||
    value.includes("10.0.2.2") ||
    value.includes("0.0.0.0") ||
    value.includes("192.168.") ||
    value.includes("172.") ||
    value.startsWith("http://")
  );
}

/**
 * Resolve the URL the admin WebView should load.
 *
 * Resolution order:
 *  1. `app.json` -> `expo.extra.adminUrl`, but only if it is a safe HTTPS URL.
 *  2. Otherwise fall back to {@link PRODUCTION_ADMIN_URL}.
 *
 * In a development build (`__DEV__`) an unsafe override throws loudly so the
 * mistake is caught before it ever reaches a device. In a production build we
 * never throw — we silently fall back to the production URL so the APK can
 * never ship pointing at localhost.
 */
export function getAdminWebViewUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
  const configured = typeof extra.adminUrl === "string" ? extra.adminUrl.trim() : "";

  if (configured && !isUnsafeUrl(configured)) {
    return configured;
  }

  if (configured && isUnsafeUrl(configured)) {
    const message =
      `Unsafe admin URL in expo.extra.adminUrl: "${configured}". ` +
      `localhost/127.0.0.1/10.0.2.2/LAN IPs/http:// are unreachable from a ` +
      `real Android device. Falling back to ${PRODUCTION_ADMIN_URL}.`;
    if (__DEV__) {
      throw new Error(message);
    }
    // Production: never crash, always ship the safe URL.
    console.warn(message);
  }

  return PRODUCTION_ADMIN_URL;
}

/**
 * The host(s) allowed to render inside the WebView. Anything else is handed
 * off to the system browser. Derived from the resolved (safe) admin URL.
 */
export function getAllowedHosts(): string[] {
  try {
    return [new URL(getAdminWebViewUrl()).host];
  } catch {
    return [PRODUCTION_ADMIN_HOST];
  }
}
