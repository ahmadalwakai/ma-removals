import { Pressable, StyleSheet, Text, View } from "react-native";

import { APP_NAME, colors } from "../config";

interface Props {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{APP_NAME}</Text>
      <Text style={styles.subtitle}>Locked for your security</Text>
      <Pressable
        style={styles.button}
        accessibilityRole="button"
        onPress={onUnlock}
      >
        <Text style={styles.buttonText}>Unlock</Text>
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
    color: colors.slate400,
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
