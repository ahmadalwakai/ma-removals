import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { APP_NAME, colors } from "../config";

type Props = {
  /** Optional secondary line beneath the brand mark. */
  message?: string;
};

/**
 * Brand splash / loading view. Shown while the WebView boots and while
 * the user pulls-to-refresh below an empty document.
 */
export function Splash({ message }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.mark}>
        <Text style={styles.markText}>M&A</Text>
      </View>
      <Text style={styles.title}>{APP_NAME}</Text>
      <Text style={styles.subtitle}>Operations Console</Text>
      <ActivityIndicator
        size="small"
        color={colors.emerald}
        style={styles.spinner}
      />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: colors.emerald,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  markText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  title: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  subtitle: {
    color: colors.slate400,
    fontSize: 13,
    marginTop: 4,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  spinner: {
    marginTop: 28,
  },
  message: {
    color: colors.slate400,
    fontSize: 13,
    marginTop: 14,
    textAlign: "center",
  },
});
