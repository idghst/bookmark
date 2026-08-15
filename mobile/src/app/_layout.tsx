import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { APP_THEME } from "@/theme/tokens";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = APP_THEME[colorScheme === "dark" ? "dark" : "light"];

  return (
    <SafeAreaProvider>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="settings" options={{ presentation: "modal" }} />
        <Stack.Screen name="add" options={{ presentation: "modal" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
