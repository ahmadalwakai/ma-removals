import { StatusBar } from "expo-status-bar";
import { I18nManager, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { AdminApp } from "./src/screens/AdminApp";

I18nManager.allowRTL(true);
I18nManager.forceRTL(false);

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        <SafeAreaView
          style={styles.safe}
          edges={["top", "left", "right"]}
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
    backgroundColor: "#FFFFFF",
  },
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});
