import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../config";

type Props = {
  description?: string | null;
  /** The URL that failed to load. Shown only in development builds. */
  failedUrl?: string | null;
  onRetry: () => void;
};

export function ErrorScreen({ description, failedUrl, onRetry }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Couldn't load admin console</Text>
      <Text style={styles.body}>
        {description ??
          "The admin dashboard couldn't be reached. Check your connection and try again."}
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
        <Text style={styles.buttonText}>Reload</Text>
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
    color: colors.slate400,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 28,
  },
  debugUrl: {
    color: colors.slate500,
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
