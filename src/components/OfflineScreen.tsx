import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../config";
import { type Language, uiText } from "../lib/i18n";

type Props = {
  language: Language;
  onRetry: () => void;
};

export function OfflineScreen({ language, onRetry }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>!</Text>
      </View>
      <Text style={styles.title}>{uiText(language, "You are offline", "أنت غير متصل")}</Text>
      <Text style={styles.body}>
        {uiText(
          language,
          "Check your internet connection. The admin app needs connectivity to sync bookings, drivers, and live jobs.",
          "تحقق من اتصالك بالإنترنت. تحتاج لوحة الإدارة إلى الاتصال لمزامنة الحجوزات والسائقين والمهام مباشرة.",
        )}
      </Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [
          styles.button,
          pressed && { opacity: 0.85 },
        ]}
        android_ripple={{ color: colors.emeraldDark }}
      >
        <Text style={styles.buttonText}>{uiText(language, "Try again", "حاول مرة أخرى")}</Text>
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
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.inkSoft,
    borderWidth: 2,
    borderColor: colors.emerald,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  iconText: {
    color: colors.emerald,
    fontSize: 30,
    fontWeight: "800",
  },
  title: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  body: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 28,
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
