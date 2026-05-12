import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: "#0a0f1e" },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="dashboard" />
      </Stack>
    </SafeAreaProvider>
  );
}
