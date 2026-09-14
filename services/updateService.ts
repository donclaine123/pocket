import * as Updates from "expo-updates";
import { Platform } from "react-native";

export interface UpdateCheckResult {
  isAvailable: boolean;
  isEnabled: boolean;
  version: string;
  error?: string;
}

/**
 * Gets the current app runtime version and update state.
 */
export function getAppVersionInfo(): {
  version: string;
  updateId: string | null;
  channel: string | null;
  isEmbedded: boolean;
  isSupported: boolean;
} {
  return {
    version: Updates.runtimeVersion ?? "1.0.0",
    updateId: Updates.updateId ?? null,
    channel: Updates.channel ?? null,
    isEmbedded: Updates.isEmbeddedLaunch,
    isSupported: Updates.isEnabled && Platform.OS !== "web" && !__DEV__,
  };
}

/**
 * Checks if a newer Over-The-Air (OTA) update bundle is published.
 * In development, Expo Go, or Web, safely reports that the app is on the latest code.
 */
export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const version = Updates.runtimeVersion ?? "1.0.0";

  // Updates are only active in production builds on iOS/Android
  if (!Updates.isEnabled || Platform.OS === "web" || __DEV__) {
    return {
      isAvailable: false,
      isEnabled: false,
      version,
    };
  }

  try {
    const update = await Updates.checkForUpdateAsync();
    return {
      isAvailable: update.isAvailable,
      isEnabled: true,
      version,
    };
  } catch (error: any) {
    console.warn("[UpdateService] Check update error:", error);
    return {
      isAvailable: false,
      isEnabled: true,
      version,
      error: error?.message || "Failed to check for updates",
    };
  }
}

/**
 * Downloads the new update bundle in the background without interrupting the user.
 */
export async function downloadAppUpdate(): Promise<boolean> {
  if (!Updates.isEnabled || Platform.OS === "web" || __DEV__) {
    return false;
  }

  try {
    const result = await Updates.fetchUpdateAsync();
    return result.isNew;
  } catch (error) {
    console.error("[UpdateService] Download update error:", error);
    return false;
  }
}

/**
 * Restarts the app immediately to apply the downloaded update.
 * ZERO DATA LOSS: Because the app is never uninstalled, local SQLite and
 * AsyncStorage files remain completely untouched on the phone.
 */
export async function applyUpdateAndRestart(): Promise<void> {
  if (!Updates.isEnabled || Platform.OS === "web" || __DEV__) {
    return;
  }

  try {
    await Updates.reloadAsync();
  } catch (error) {
    console.error("[UpdateService] Reload error:", error);
  }
}
