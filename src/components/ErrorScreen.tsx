import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../config";
import { type Language, uiText } from "../lib/i18n";

type Props = {
  description?: string | null;
  /** The URL that failed to load. Shown only in development builds. */
  failedUrl?: string | null;
  language: Language;
  onRetry: () => void;
};

export function ErrorScreen({ description, failedUrl, language, onRetry }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>
        {uiText(language, "Could not load the admin panel", "تعذر تحميل لوحة الإدارة")}
      </Text>
      <Text style={styles.body}>
        {description ??
          uiText(
            language,
            "The admin panel could not be reached. Check the connection and try again.",
            "تعذر الوصول إلى لوحة الإدارة. تحقق من الاتصال ثم حاول مرة أخرى.",
          )}
      </Text>
      {/* Surface the failing URL only in development so we never leak internal
          endpoints in a shipped APK. */}
      {__DEV__ && failedUrl ? (
        <Text style={styles.debugUrl} numberOfLines={2}>
          {failedUrl}
        </Text>
      ) : null}
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [
          styles.button,
          pressed && { opacity: 0.85 },
        ]}
        android_ripple={{ color: colors.emeraldDark }}
      >
        <Text style={styles.buttonText}>
          {uiText(language, "Reload", "إعادة التحميل")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  title: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  body: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 28,
  },
  debugUrl: {
    color: colors.white,
    fontSize: 12,
    fontFamily: "monospace",
    textAlign: "center",
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.emerald,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
