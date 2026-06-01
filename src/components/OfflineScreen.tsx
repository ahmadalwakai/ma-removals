import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../config";

type Props = {
  onRetry: () => void;
};

export function OfflineScreen({ onRetry }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>!</Text>
      </View>
      <Text style={styles.title}>You're offline</Text>
      <Text style={styles.body}>
        Check your connection — the admin console needs internet access to
        sync bookings, drivers and jobs in real time.
      </Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [
          styles.button,
          pressed && { opacity: 0.85 },
        ]}
        android_ripple={{ color: colors.emeraldDark }}
      >
        <Text style={styles.buttonText}>Try again</Text>
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
    color: colors.slate400,
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
