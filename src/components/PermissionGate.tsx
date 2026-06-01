import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors } from "../config";
import type { PermissionGateState } from "../hooks/usePermissionGate";

interface Props {
  gate: PermissionGateState;
}

/**
 * Blocking screen shown when the lock-screen alert permissions are not
 * yet granted on Android 14+. The admin app's core value is reliable
 * new-booking / SOS alerts over the lock screen, which silently fail
 * without USE_FULL_SCREEN_INTENT and a battery-optimisation exemption.
 */
export function PermissionGate({ gate }: Props) {
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>One more step</Text>
        <Text style={styles.subtitle}>
          To make sure new bookings and SOS alerts wake the screen even when
          your phone is locked, please grant the permissions below.
        </Text>

        {!gate.fullScreenIntent ? (
          <PermissionRow
            label="Full-screen alerts"
            description="Lets alerts pop over the lock screen."
            actionLabel="Allow"
            onPress={gate.openFullScreenIntentSettings}
          />
        ) : null}

        {!gate.batteryUnrestricted ? (
          <PermissionRow
            label="Unrestricted battery"
            description="Keeps alerts arriving when the app is closed."
            actionLabel="Allow"
            onPress={gate.requestBatteryExemption}
          />
        ) : null}

        <Pressable
          style={styles.refreshButton}
          accessibilityRole="button"
          onPress={gate.refresh}
        >
          <Text style={styles.refreshText}>I've granted these</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

interface RowProps {
  label: string;
  description: string;
  actionLabel: string;
  onPress: () => void;
}

function PermissionRow({ label, description, actionLabel, onPress }: RowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Pressable
        style={styles.allowButton}
        accessibilityRole="button"
        onPress={onPress}
      >
        <Text style={styles.allowText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 28,
  },
  title: {
    color: colors.white,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 10,
  },
  subtitle: {
    color: colors.slate400,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inkSoft,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },
  rowText: {
    flex: 1,
    paddingRight: 14,
  },
  rowLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  rowDescription: {
    color: colors.slate400,
    fontSize: 13,
    lineHeight: 18,
  },
  allowButton: {
    backgroundColor: colors.emerald,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  allowText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
  refreshButton: {
    marginTop: 18,
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  refreshText: {
    color: colors.slate400,
    fontSize: 15,
    fontWeight: "600",
  },
});
