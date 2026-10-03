import Constants from "expo-constants";

/**
 * Canonical production admin URL. The native app uses this only to derive
 * the backend origin for `/api/admin/mobile/*` and to keep any configured
 * URL away from localhost / cleartext mistakes.
 *
 * NOTE: this points at the canonical `www.` host. The apex
 * (`maremovals.com`) 301-redirects to `www.maremovals.com`.
 */
export const PRODUCTION_ADMIN_URL = "https://www.maremovals.com/admin";

type Extra = {
  apiBaseUrl?: string;
  adminUrl?: string;
};

/**
 * Substrings / shapes that must NEVER be the active production URL in a
 * shipped APK. They all point at a developer machine and are unreachable from
 * a real Android device:
 *
 *  - `localhost` / `127.0.0.1` resolve to the *phone itself*, not your PC, so
 *    API calls hit the phone rather than the server.
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

function isLocalWebPreview(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/**
 * Resolve the canonical admin web URL.
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
export function getConfiguredAdminUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
  const configured = typeof extra.adminUrl === "string" ? extra.adminUrl.trim() : "";

  if (isLocalWebPreview()) {
    return "http://localhost:3000/admin";
  }

  if (configured && !isUnsafeUrl(configured)) {
    return configured;
  }

  // Expo web in local dev runs in the browser on the same machine, so
  // localhost can be valid there. Keep production locked down.
  if (configured && isUnsafeUrl(configured) && __DEV__ && typeof window !== "undefined") {
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
 * Base origin for native API calls. The native admin app talks to
 * `/api/admin/mobile/*` directly.
 */
export function getAdminApiBaseUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
  const configured =
    typeof extra.apiBaseUrl === "string" ? extra.apiBaseUrl.trim() : "";

  if (isLocalWebPreview()) {
    return "http://localhost:3000";
  }

  if (configured && !isUnsafeUrl(configured)) {
    return new URL(configured).origin;
  }

  if (configured && isUnsafeUrl(configured) && __DEV__ && typeof window !== "undefined") {
    return new URL(configured).origin;
  }

  if (__DEV__ && typeof window !== "undefined") {
    return "http://localhost:3000";
  }

  try {
    return new URL(getConfiguredAdminUrl()).origin;
  } catch {
    return new URL(PRODUCTION_ADMIN_URL).origin;
  }
}
