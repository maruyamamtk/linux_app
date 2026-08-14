import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { RootNavigator } from "./src/navigation/RootNavigator";
import { SettingsProvider, useSettings } from "./src/state/SettingsContext";

function AppStatusBar() {
  const { resolvedTheme } = useSettings();
  return <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AppStatusBar />
        <RootNavigator />
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
