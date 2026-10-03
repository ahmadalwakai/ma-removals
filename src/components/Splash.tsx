import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "../config";
import { appDisplayName, type Language, uiText } from "../lib/i18n";

type Props = {
  /** Optional secondary line beneath the brand mark. */
  message?: string;
  language: Language;
};

/**
 * Brand splash / loading view shown while the native admin app boots or syncs.
 */
export function Splash({ message, language }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.mark}>
        <Text style={styles.markText}>M&A</Text>
      </View>
      <Text style={styles.title}>{appDisplayName(language)}</Text>
      <Text style={styles.subtitle}>
        {uiText(language, "Operations board", "لوحة العمليات")}
      </Text>
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
    color: colors.white,
    fontSize: 13,
    marginTop: 4,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  spinner: {
    marginTop: 28,
  },
  message: {
    color: colors.white,
    fontSize: 13,
    marginTop: 14,
    textAlign: "center",
  },
});
