import Constants from "expo-constants";

import { getAdminWebViewUrl, getAllowedHosts } from "./lib/admin-url";

/** App version reported to the web via UA and the native bridge. */
export const APP_VERSION: string =
  Constants.expoConfig?.version ?? "1.0.0";

/**
 * Base URL of the M&A Removals admin web app. Resolved through the production
 * safety layer in `lib/admin-url`, which rejects localhost / cleartext URLs
 * so a shipped APK can never point at a developer machine.
 */
export const ADMIN_URL: string = getAdminWebViewUrl();

/**
 * Allowed host(s). Navigation to any host outside this list is opened
 * in the system browser instead of inside the WebView (auth providers,
 * external help links, etc.). Driver/customer pages on the same origin
 * are still allowed because they share the host.
 */
export const ALLOWED_HOSTS: string[] = getAllowedHosts();

/**
 * Brand tokens — mirror the web admin (Chakra theme + globals.css).
 */
export const colors = {
  emerald: "#10B981",
  emeraldDark: "#059669",
  ink: "#0F172A",
  inkSoft: "#1E293B",
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
export const NOTIFICATION_CHANNEL_ID = "ma-admin-alerts";
export const NOTIFICATION_CHANNEL_NAME = "Admin Alerts";

/**
 * Time the app may sit in the background before it requires
 * biometric re-auth on return. 5 minutes is a sensible default
 * for a tool that holds refund and pricing controls.
 */
export const APP_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
