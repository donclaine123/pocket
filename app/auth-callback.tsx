import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "../database/supabase";
import { COLORS, FONTS } from "../constants/theme";
import { extractAuthParams } from "../services/authUtils";
import { safeHaptic } from "../services/haptics";
import { syncGuestTransactionsToAccount } from "../services/storage";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [statusText, setStatusText] = useState("Confirming your account... ✿");

  useEffect(() => {
    let isMounted = true;

    async function handleCallback() {
      try {
        const initialUrl = await Linking.getInitialURL();
        const currentUrl = typeof window !== "undefined" ? window.location.href : "";
        const targetUrl = initialUrl || currentUrl || "";

        const { accessToken, refreshToken, code, tokenHash, type, errorDescription } =
          extractAuthParams(targetUrl);

        if (errorDescription) {
          throw new Error(errorDescription);
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });
          if (error) throw error;
        }

        // Only sync guest transactions when creating a new account (signup)
        if (type === "signup") {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            await syncGuestTransactionsToAccount(user.id);
          }
        }

        if (isMounted) {
          safeHaptic.success();
          setStatusText("Account confirmed! Opening journal... ✿");
          setTimeout(() => {
            router.replace("/");
          }, 500);
        }
      } catch (err: any) {
        console.warn("[AuthCallback] Error completing confirmation:", err);
        if (isMounted) {
          safeHaptic.warning();
          setStatusText("Could not confirm account. Returning to journal...");
          setTimeout(() => {
            router.replace("/");
          }, 1200);
        }
      }
    }

    handleCallback();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.peach} />
      <Text style={styles.title}>pocket. penny journal</Text>
      <Text style={styles.subtitle}>{statusText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontFamily: FONTS.displayBold,
    fontSize: 20,
    color: COLORS.ink,
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.inkSoft,
    textAlign: "center",
  },
});
