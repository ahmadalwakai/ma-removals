import Constants from "expo-constants";

import {
  getAdminApiBaseUrl,
  getConfiguredAdminUrl,
} from "./lib/admin-url";

/** App version reported to the API and native alert stack. */
export const APP_VERSION: string =
  Constants.expoConfig?.version ?? "1.0.0";

/**
 * Canonical URL of the M&A Removals admin web app. Resolved through the production
 * safety layer in `lib/admin-url`, which rejects localhost / cleartext URLs
 * so a shipped APK can never point at a developer machine.
 */
export const ADMIN_WEB_URL: string = getConfiguredAdminUrl();

/** Production backend origin used by the native admin API client. */
export const API_BASE_URL: string = getAdminApiBaseUrl();

/** Public Mapbox token used only for static route preview images. */
export const MAPBOX_PUBLIC_TOKEN: string = (
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN ??
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  ""
).replace(/^"|"$/g, "");

/**
 * Brand tokens — mirror the web admin (Chakra theme + globals.css).
 */
export const colors = {
  emerald: "#2563EB",
  emeraldDark: "#2563EB",
  ink: "#000000",
  inkSoft: "#0A0A0C",
  slate50: "#F1F5F9",
  slate200: "#E2E8F0",
  slate400: "#94A3B8",
  slate500: "#64748B",
  slate600: "#475569",
  white: "#FFFFFF",
  danger: "#EF4444",
} as const;

export const APP_NAME = "M&A Admin";

/**
 * Single FCM data channel id used for high-priority admin alerts
 * (new bookings, driver SOS, chat replies). Mirrors the channel
 * created natively in Notifier.kt.
 */
export const NOTIFICATION_CHANNEL_ID = "ma-admin-critical-alerts-v2";
export const NOTIFICATION_CHANNEL_NAME = "Admin alerts";

/**
 * Time the app may sit in the background before it requires
 * biometric re-auth on return. 5 minutes is a sensible default
 * for a tool that holds refund and pricing controls.
 */
export const APP_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
