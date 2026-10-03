import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors } from "../config";
import type { PermissionGateState } from "../hooks/usePermissionGate";
import { type Language, uiText } from "../lib/i18n";

interface Props {
  gate: PermissionGateState;
  language: Language;
}

/**
 * Blocking screen shown when the lock-screen alert permissions are not
 * yet granted on Android 14+. The admin app's core value is reliable
 * new-booking / SOS alerts over the lock screen, which silently fail
 * without USE_FULL_SCREEN_INTENT and a battery-optimisation exemption.
 */
export function PermissionGate({ gate, language }: Props) {
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{uiText(language, "One last step", "خطوة أخيرة")}</Text>
        <Text style={styles.subtitle}>
          {uiText(
            language,
            "To make new-booking and emergency alerts wake the screen even when the phone is locked, please grant the following permissions.",
            "حتى تصل تنبيهات الحجوزات الجديدة ونداءات الطوارئ وتوقظ الشاشة حتى عندما يكون الهاتف مقفولًا، يرجى منح الأذونات التالية.",
          )}
        </Text>

        {!gate.fullScreenIntent ? (
          <PermissionRow
            label={uiText(language, "Full-screen alerts", "تنبيهات ملء الشاشة")}
            description={uiText(
              language,
              "Allows urgent alerts to appear over the lock screen.",
              "تسمح للتنبيهات بالظهور فوق شاشة القفل.",
            )}
            actionLabel={uiText(language, "Allow", "السماح")}
            onPress={gate.openFullScreenIntentSettings}
          />
        ) : null}

        {!gate.batteryUnrestricted ? (
          <PermissionRow
            label={uiText(language, "Unrestricted battery", "بطارية غير مقيّدة")}
            description={uiText(
              language,
              "Keeps alerts reliable even when the app is closed.",
              "تضمن وصول التنبيهات حتى عند إغلاق التطبيق.",
            )}
            actionLabel={uiText(language, "Allow", "السماح")}
            onPress={gate.requestBatteryExemption}
          />
        ) : null}

        <Pressable
          style={styles.refreshButton}
          accessibilityRole="button"
          onPress={gate.refresh}
        >
          <Text style={styles.refreshText}>
            {uiText(language, "I granted these permissions", "منحت هذه الأذونات")}
          </Text>
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
    color: colors.white,
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
    color: colors.white,
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
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },
});
