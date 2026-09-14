import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts as useDmSans,
} from "@expo-google-fonts/dm-sans";
import {
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  useFonts as useFredoka,
} from "@expo-google-fonts/fredoka";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { COLORS } from "../constants/theme";

export default function RootLayout() {
  const [fredokaLoaded, fredokaError] = useFredoka({
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });

  const [dmSansLoaded, dmSansError] = useDmSans({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.backgroundColor = COLORS.paper;
      document.documentElement.style.overflowX = "hidden";
      if (document.body) {
        document.body.style.backgroundColor = COLORS.paper;
        document.body.style.overflowX = "hidden";
        document.body.style.margin = "0";
        document.body.style.padding = "0";
      }

      // Inject robust global CSS ensuring zero white margin / bottom void on any resolution
      const styleId = "pocket-global-style";
      let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.innerHTML = `
        html, body, #root, [data-testid="root"] {
          background-color: ${COLORS.paper} !important;
          min-height: 100% !important;
          height: 100% !important;
          width: 100% !important;
          overflow-x: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      `;
    }
  }, []);

  if ((!fredokaLoaded && !fredokaError) || (!dmSansLoaded && !dmSansError)) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.paper,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={COLORS.peach} />
      </View>
    );
  }

  return (
    <SafeAreaProvider style={{ flex: 1, width: "100%", height: "100%", backgroundColor: COLORS.paper }}>
      <StatusBar style="dark" backgroundColor={COLORS.paper} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.paper },
          animation: "fade",
        }}
      />
    </SafeAreaProvider>
  );
}
