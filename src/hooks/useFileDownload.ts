import { useCallback, useEffect } from "react";
import { Linking, PermissionsAndroid, Platform, ToastAndroid } from "react-native";

interface FileDownloadEvent {
  nativeEvent: {
    downloadUrl: string;
  };
}

/**
 * Wires the WebView's `onFileDownload` event to the system browser /
 * DownloadManager. The admin web app exports CSVs via
 * `<a href="..." download>` and PDFs via blob URLs; without this hook
 * those clicks are silently swallowed by react-native-webview on
 * Android.
 *
 * For HTTP(S) URLs we delegate to the platform via Linking — Chrome /
 * the system browser will hand the response off to DownloadManager
 * and place it under `/Downloads`. Blob/data URLs are not supported
 * by Linking, so the web side is expected to convert blobs to a
 * server-rendered URL before triggering the download.
 */
export function useFileDownload() {
  // Storage permission is no longer required for downloads on Android
  // 10+ (scoped storage). Older devices that hit the legacy code path
  // would have already been prompted by the manifest entry.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (Platform.Version >= 33) return; // POST_NOTIFICATIONS is prompted elsewhere
  }, []);

  const onFileDownload = useCallback((event: FileDownloadEvent) => {
    const url = event?.nativeEvent?.downloadUrl;
    if (!url) return;

    // Blob / data URLs cannot leave the WebView — surface a hint.
    if (url.startsWith("blob:") || url.startsWith("data:")) {
      if (Platform.OS === "android") {
        ToastAndroid.show(
          "This export isn't supported on mobile yet — open in a browser.",
          ToastAndroid.LONG,
        );
      }
      return;
    }

    void (async () => {
      // Android 13+ doesn't need WRITE_EXTERNAL_STORAGE.
      if (Platform.OS === "android" && Platform.Version < 33) {
        try {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          );
        } catch {
          /* ignore — Linking will still trigger DownloadManager */
        }
      }
      try {
        await Linking.openURL(url);
        if (Platform.OS === "android") {
          ToastAndroid.show("Downloading…", ToastAndroid.SHORT);
        }
      } catch {
        if (Platform.OS === "android") {
          ToastAndroid.show("Download failed.", ToastAndroid.SHORT);
        }
      }
    })();
  }, []);

  return { onFileDownload };
}
