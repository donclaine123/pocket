import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// SecureStore has a 2048-byte limit on Android. We chunk large strings across multiple keys.
const CHUNK_SIZE = 1800;

// Safe cross-platform storage adapter for Supabase session auth tokens
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    try {
      const countStr = await SecureStore.getItemAsync(`${key}_chunks`);
      if (countStr) {
        const count = parseInt(countStr, 10);
        let fullStr = "";
        for (let i = 0; i < count; i++) {
          const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
          if (chunk) fullStr += chunk;
        }
        return fullStr;
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    try {
      // Clean up previous chunk records if any
      const oldCountStr = await SecureStore.getItemAsync(`${key}_chunks`).catch(() => null);
      if (oldCountStr) {
        const oldCount = parseInt(oldCountStr, 10);
        for (let i = 0; i < oldCount; i++) {
          await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => {});
        }
        await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
      }

      if (value.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
      } else {
        const chunks = Math.ceil(value.length / CHUNK_SIZE);
        await SecureStore.setItemAsync(`${key}_chunks`, String(chunks));
        for (let i = 0; i < chunks; i++) {
          const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk);
        }
      }
    } catch (e) {
      console.warn("[SecureStore] Failed to save session securely:", e);
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      return;
    }
    try {
      const countStr = await SecureStore.getItemAsync(`${key}_chunks`).catch(() => null);
      if (countStr) {
        const count = parseInt(countStr, 10);
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => {});
        }
        await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
      }
      await SecureStore.deleteItemAsync(key).catch(() => {});
    } catch {}
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const isSupabaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL &&
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY &&
  !process.env.EXPO_PUBLIC_SUPABASE_URL.includes("placeholder-project")
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});
