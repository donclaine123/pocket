import * as Updates from "expo-updates";
import Constants from "expo-constants";
import { Platform } from "react-native";

export interface UpdateCheckResult {
  isAvailable: boolean;
  isEnabled: boolean;
  version: string;
  error?: string;
}

import appJson from "../app.json";

export const APP_VERSION: string =
  (appJson as any)?.expo?.version ?? Constants.expoConfig?.version ?? "1.0.1";

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
  try {
    return {
      version: APP_VERSION,
      updateId: Updates?.updateId ?? null,
      channel: Updates?.channel ?? null,
      isEmbedded: Boolean(Updates?.isEmbeddedLaunch),
      isSupported: Boolean(Updates?.isEnabled && Platform.OS !== "web" && !__DEV__),
    };
  } catch {
    return {
      version: APP_VERSION,
      updateId: null,
      channel: null,
      isEmbedded: true,
      isSupported: false,
    };
  }
}

/**
 * Checks if a newer Over-The-Air (OTA) update bundle is published.
 * In development, Expo Go, or Web, safely reports that the app is on the latest code.
 */
export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const version = APP_VERSION;

  try {
    if (!Updates?.isEnabled || Platform.OS === "web" || __DEV__) {
      return {
        isAvailable: false,
        isEnabled: false,
        version,
      };
    }

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
      isEnabled: false,
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
