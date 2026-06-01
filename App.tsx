import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { colors } from "./src/config";
import { AdminApp } from "./src/screens/AdminApp";

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        <SafeAreaView
          style={styles.safe}
          edges={["top", "bottom", "left", "right"]}
        >
          <AdminApp />
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  safe: {
    flex: 1,
    backgroundColor: colors.ink,
  },
});
