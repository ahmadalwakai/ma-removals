import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";

import { ADMIN_URL, ALLOWED_HOSTS, APP_VERSION, colors } from "../config";
import { ErrorScreen } from "../components/ErrorScreen";
import { LockScreen } from "../components/LockScreen";
import { OfflineScreen } from "../components/OfflineScreen";
import { PermissionGate } from "../components/PermissionGate";
import { Splash } from "../components/Splash";
import { useAppLock } from "../hooks/useAppLock";
import { useBackgroundReload } from "../hooks/useBackgroundReload";
import { useDeepLink } from "../hooks/useDeepLink";
import { useDoubleBackToExit } from "../hooks/useDoubleBackToExit";
import { useFileDownload } from "../hooks/useFileDownload";
import { usePermissionGate } from "../hooks/usePermissionGate";
import { usePushRegistration } from "../hooks/usePushRegistration";

/**
 * JS payload injected on every navigation. Exposes a typed
 * native bridge:
 *   - MARemovalsNative.platform / .version
 *   - MARemovalsNative.post({ type, ... })           — JS → native
 *   - MARemovalsNative.onEvent(fn)                   — subscribe to native → JS
 *   - window.__maRemovalsDispatchNative(json)        — wire used by
 *     injectJavaScript on the React Native side.
 */
const INJECTED_JS = `
  (function () {
    try {
      var meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'viewport');
        document.head && document.head.appendChild(meta);
      }
      meta.setAttribute(
        'content',
        'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'
      );

      if (document.documentElement) {
        document.documentElement.classList.add('ma-native', 'ma-native-android');
      }

      if (!window.MARemovalsNative) {
        var listeners = [];
        window.MARemovalsNative = {
          platform: 'android',
          version: '${APP_VERSION}',
          post: function (msg) {
            try {
              window.ReactNativeWebView.postMessage(JSON.stringify(msg || {}));
            } catch (e) { /* noop */ }
          },
          onEvent: function (fn) {
            if (typeof fn !== 'function') return function () {};
            listeners.push(fn);
            return function () {
              listeners = listeners.filter(function (l) { return l !== fn; });
            };
          },
          _dispatch: function (evt) {
            listeners.slice().forEach(function (l) {
              try { l(evt); } catch (e) { /* noop */ }
            });
          }
        };
        window.__maRemovalsDispatchNative = function (raw) {
          try {
            var evt = typeof raw === 'string' ? JSON.parse(raw) : raw;
            window.MARemovalsNative._dispatch(evt);
          } catch (e) { /* noop */ }
        };
      }

      var __origOpen = window.open;
      window.open = function (url) {
        try {
          if (typeof url === 'string') {
            window.location.href = url;
            return null;
          }
        } catch (e) { /* fall through */ }
        if (__origOpen) return __origOpen.apply(window, arguments);
        return null;
      };
    } catch (e) { /* noop */ }
    true;
  })();
`;

type BridgeMessage =
  | { type: "open-external"; url: string }
  | { type: "reload" }
  | { type: "lock" }
  | { type: "log"; level?: "info" | "warn" | "error"; message: string }
  | { type: string; payload?: unknown };

export function AdminApp() {
  // The native shell wraps the admin web app via react-native-webview, which
  // is not supported on web. When running under Expo Web just hand off to the
  // real admin URL so the splash doesn't hang forever.
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location.href !== ADMIN_URL) {
      window.location.replace(ADMIN_URL);
    }
    return <Splash message="Opening admin console…" />;
  }

  const webRef = useRef<WebView>(null);

  const [isOnline, setIsOnline] = useState(true);
  const [hasFatalError, setHasFatalError] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const canGoBackRef = useRef(false);

  const lock = useAppLock();
  const deepLink = useDeepLink();
  const permissionGate = usePermissionGate();
  const { onFileDownload } = useFileDownload();

  /** ------------------------------ Connectivity ----------------------- */
  useEffect(() => {
    const apply = (state: NetInfoState) => {
      setIsOnline(
        state.isConnected !== false && state.isInternetReachable !== false,
      );
    };
    NetInfo.fetch().then(apply);
    const unsub = NetInfo.addEventListener(apply);
    return () => unsub();
  }, []);

  /** ----------------------- Native → JS event helper ------------------ */
  const dispatchToWeb = useCallback((payload: Record<string, unknown>) => {
    if (!webRef.current) return;
    const serialised = JSON.stringify(payload).replace(/<\/script/gi, "<\\/script");
    webRef.current.injectJavaScript(
      `window.__maRemovalsDispatchNative && window.__maRemovalsDispatchNative(${serialised}); true;`,
    );
  }, []);

  /** ------------------------- FCM token bridge ------------------------ */
  const onFcmToken = useCallback(
    (token: string) => {
      dispatchToWeb({ type: "push-token", token, platform: "android" });
    },
    [dispatchToWeb],
  );
  usePushRegistration(onFcmToken);

  /** ------------------------------ Reload helper ---------------------- */
  const reload = useCallback(() => {
    setHasFatalError(null);
    setFailedUrl(null);
    setIsLoading(true);
    webRef.current?.reload();
  }, []);

  const goBack = useCallback(() => {
    webRef.current?.goBack();
  }, []);

  /** ------------------- Hardware back + background reload ------------- */
  useDoubleBackToExit(canGoBackRef, goBack);
  useBackgroundReload(reload);

  /** ----------------------- Deep-link routing ------------------------- */
  useEffect(() => {
    if (!deepLink.pendingPath) return;
    if (lock.state !== "unlocked") return; // wait until user has authenticated
    let target = deepLink.pendingPath;
    if (!/^https?:\/\//.test(target)) {
      try {
        const base = new URL(ADMIN_URL);
        target = new URL(target, base.origin).toString();
      } catch {
        target = ADMIN_URL;
      }
    }
    webRef.current?.injectJavaScript(
      `window.location.replace(${JSON.stringify(target)}); true;`,
    );
    deepLink.consume();
  }, [deepLink, lock.state]);

  /** ------------------------- WebView callbacks ----------------------- */
  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    canGoBackRef.current = nav.canGoBack;
  }, []);

  /**
   * Decide whether a URL load happens inside the WebView or is handed
   * off to the system (browser / dialer / mail / maps).
   */
  const onShouldStartLoadWithRequest = useCallback(
    (req: ShouldStartLoadRequest): boolean => {
      const url = req.url;

      if (url.startsWith("about:") || url.startsWith("data:")) return true;

      if (
        url.startsWith("tel:") ||
        url.startsWith("mailto:") ||
        url.startsWith("sms:") ||
        url.startsWith("geo:") ||
        url.startsWith("intent:") ||
        url.startsWith("whatsapp:")
      ) {
        Linking.openURL(url).catch(() => {});
        return false;
      }

      try {
        const parsed = new URL(url);
        if (ALLOWED_HOSTS.includes(parsed.host)) return true;
      } catch {
        return true;
      }

      Linking.openURL(url).catch(() => {});
      return false;
    },
    [],
  );

  const onMessage = useCallback(
    (evt: WebViewMessageEvent) => {
      let msg: BridgeMessage | null = null;
      try {
        msg = JSON.parse(evt.nativeEvent.data) as BridgeMessage;
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== "string") return;

      switch (msg.type) {
        case "open-external":
          if ("url" in msg && typeof msg.url === "string") {
            Linking.openURL(msg.url).catch(() => {});
          }
          break;
        case "reload":
          reload();
          break;
        case "lock":
          lock.lock();
          break;
        default:
          break;
      }
    },
    [reload, lock],
  );

  const onLoadStart = useCallback(() => {
    setHasFatalError(null);
  }, []);

  const onLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  const onError = useCallback(
    (syntheticEvent: {
      nativeEvent: { description?: string; code?: number; url?: string };
    }) => {
      // -999 = request cancelled (user navigated away). Ignore.
      if (syntheticEvent.nativeEvent.code === -999) return;
      setFailedUrl(syntheticEvent.nativeEvent.url ?? ADMIN_URL);
      setHasFatalError(
        syntheticEvent.nativeEvent.description ?? "Network error.",
      );
    },
    [],
  );

  const onHttpError = useCallback(
    (syntheticEvent: { nativeEvent: { statusCode: number; url: string } }) => {
      const { statusCode, url } = syntheticEvent.nativeEvent;
      const isDocument = !!url && (
        url === ADMIN_URL ||
        url.startsWith(ADMIN_URL) ||
        ALLOWED_HOSTS.some((h) => {
          try { return new URL(url).host === h; } catch { return false; }
        })
      );
      if (!isDocument) return;
      if (statusCode >= 500) {
        setFailedUrl(url);
        setHasFatalError(`Server error (${statusCode}). Please try again.`);
      }
    },
    [],
  );

  const userAgentSuffix = useMemo(
    () => `MARemovalsAdmin/${APP_VERSION} (Android; ${Platform.Version})`,
    [],
  );

  /** ------------------------------- Render ---------------------------- */
  if (!isOnline) {
    return <OfflineScreen onRetry={reload} />;
  }

  return (
    <View style={styles.root}>
      <WebView
        ref={webRef}
        source={{ uri: ADMIN_URL }}
        originWhitelist={["https://*", "about:*", "data:*"]}
        // Auth / cookies
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        // UX
        pullToRefreshEnabled
        allowsBackForwardNavigationGestures
        startInLoadingState
        domStorageEnabled
        javaScriptEnabled
        cacheEnabled
        // Media / uploads — file input + camera capture must work.
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowsFullscreenVideo
        // Production is HTTPS only — never allow cleartext/mixed content.
        mixedContentMode="never"
        setSupportMultipleWindows={false}
        // Identify ourselves so server-side analytics can flag native traffic
        applicationNameForUserAgent={userAgentSuffix}
        // Behavior hooks
        injectedJavaScript={INJECTED_JS}
        injectedJavaScriptBeforeContentLoaded={INJECTED_JS}
        onMessage={onMessage}
        onNavigationStateChange={onNavigationStateChange}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onLoadStart={onLoadStart}
        onLoadEnd={onLoadEnd}
        onError={onError}
        onHttpError={onHttpError}
        onFileDownload={onFileDownload}
        renderLoading={() => <Splash />}
        style={styles.webview}
        containerStyle={styles.webview}
      />

      {isLoading ? (
        <View style={styles.coverLayer} pointerEvents="none">
          <Splash />
        </View>
      ) : null}

      {hasFatalError ? (
        <View style={styles.coverLayer}>
          <ErrorScreen
            description={hasFatalError}
            failedUrl={failedUrl}
            onRetry={reload}
          />
        </View>
      ) : null}

      {/* App lock sits on top of everything (incl. error screen) so PII
          stays hidden when the device is unattended. */}
      {lock.state !== "unlocked" ? (
        <View style={styles.coverLayer}>
          <LockScreen onUnlock={() => void lock.authenticate()} />
        </View>
      ) : null}

      {/* Once unlocked, force the lock-screen-alert permissions before the
          console is usable — without them alerts silently fail on 14+. */}
      {lock.state === "unlocked" &&
      !permissionGate.checking &&
      !permissionGate.allGranted ? (
        <View style={styles.coverLayer}>
          <PermissionGate gate={permissionGate} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  coverLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
