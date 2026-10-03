import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../config";
import { appDisplayName, type Language, uiText } from "../lib/i18n";

interface Props {
  language: Language;
  onUnlock: () => void;
}

export function LockScreen({ language, onUnlock }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{appDisplayName(language)}</Text>
      <Text style={styles.subtitle}>
        {uiText(language, "Locked to protect your account", "مقفول لحماية حسابك")}
      </Text>
      <Pressable
        style={styles.button}
        accessibilityRole="button"
        onPress={onUnlock}
      >
        <Text style={styles.buttonText}>
          {uiText(language, "Unlock", "فتح القفل")}
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
    padding: 32,
  },
  title: {
    color: colors.white,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: colors.white,
    fontSize: 14,
    marginBottom: 32,
  },
  button: {
    backgroundColor: colors.emerald,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
  },
  buttonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },
});
