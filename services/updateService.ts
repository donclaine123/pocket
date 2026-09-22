import * as Updates from "expo-updates";
import Constants from "expo-constants";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import appJson from "../app.json";

export interface UpdateCheckResult {
  isAvailable: boolean;
  isEnabled: boolean;
  version: string;
  updateType: "apk" | "ota" | "none";
  apkDownloadUrl?: string;
  apkSize?: number;
  releaseName?: string;
  releaseNotes?: string;
  error?: string;
}

export const APP_VERSION: string =
  (appJson as any)?.expo?.version ?? Constants.expoConfig?.version ?? "1.0.1";

const GITHUB_REPO_OWNER = "donclaine123";
const GITHUB_REPO_NAME = "pocket";

/**
 * Compares two semantic version strings (e.g. "1.0.2" vs "1.0.1" or "v1.0.2").
 * Returns true if remote is strictly newer than current.
 */
export function isVersionNewer(remote: string, current: string): boolean {
  const cleanRemote = remote.replace(/^[vV]/, "").trim();
  const cleanCurrent = current.replace(/^[vV]/, "").trim();

  const rParts = cleanRemote.split(".").map((n) => parseInt(n, 10) || 0);
  const cParts = cleanCurrent.split(".").map((n) => parseInt(n, 10) || 0);

  const maxLen = Math.max(rParts.length, cParts.length);
  for (let i = 0; i < maxLen; i++) {
    const r = rParts[i] ?? 0;
    const c = cParts[i] ?? 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
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
 * Checks for either a new native APK release on GitHub, or an OTA JavaScript update.
 * APK updates take priority if a newer native version is detected on Android.
 */
export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = APP_VERSION;

  // 1. On Android, check GitHub Releases for a newer .apk binary
  if (Platform.OS === "android") {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "Pocket-App-Updater",
          },
        }
      );

      if (response.ok) {
        const release = await response.json();
        const remoteTag = release?.tag_name || release?.name || "";

        if (remoteTag && isVersionNewer(remoteTag, currentVersion)) {
          const assets = Array.isArray(release.assets) ? release.assets : [];
          // Find an APK asset (or any file ending in .apk)
          const apkAsset = assets.find(
            (a: any) =>
              typeof a.name === "string" && a.name.toLowerCase().endsWith(".apk")
          );

          if (apkAsset && apkAsset.browser_download_url) {
            return {
              isAvailable: true,
              isEnabled: true,
              version: remoteTag.replace(/^[vV]/, ""),
              updateType: "apk",
              apkDownloadUrl: apkAsset.browser_download_url,
              apkSize: apkAsset.size,
              releaseName: release.name || remoteTag,
              releaseNotes: release.body || "",
            };
          }
        }
      }
    } catch (githubErr) {
      console.warn("[UpdateService] GitHub releases check warning:", githubErr);
      // Fall through to OTA update check
    }
  }

  // 2. Fall back to Expo Over-The-Air (OTA) update check
  try {
    if (!Updates?.isEnabled || Platform.OS === "web" || __DEV__) {
      return {
        isAvailable: false,
        isEnabled: false,
        version: currentVersion,
        updateType: "none",
      };
    }

    const update = await Updates.checkForUpdateAsync();
    return {
      isAvailable: update.isAvailable,
      isEnabled: true,
      version: currentVersion,
      updateType: update.isAvailable ? "ota" : "none",
    };
  } catch (error: any) {
    console.warn("[UpdateService] OTA update check warning:", error);
    return {
      isAvailable: false,
      isEnabled: false,
      version: currentVersion,
      updateType: "none",
      error: error?.message || "Failed to check for updates",
    };
  }
}

/**
 * Downloads a newer APK file to the device cache with real-time progress callback.
 */
export async function downloadApkWithProgress(
  apkUrl: string,
  onProgress?: (progressFraction: number) => void
): Promise<string | null> {
  try {
    const fileUri = `${FileSystem.documentDirectory}pocket-update.apk`;

    // Remove any previously downloaded APK file to ensure clean write
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }

    const downloadResumable = FileSystem.createDownloadResumable(
      apkUrl,
      fileUri,
      {},
      (downloadProgress) => {
        if (
          downloadProgress.totalBytesExpectedToWrite &&
          downloadProgress.totalBytesExpectedToWrite > 0
        ) {
          const progress =
            downloadProgress.totalBytesWritten /
            downloadProgress.totalBytesExpectedToWrite;
          onProgress?.(Math.min(Math.max(progress, 0), 1));
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    return result?.uri || null;
  } catch (err) {
    console.error("[UpdateService] Error downloading APK:", err);
    return null;
  }
}

/**
 * Opens Android's native Package Installer for the downloaded APK.
 * Prompts user: "Do you want to update this application? Your data will not be lost."
 */
export async function installDownloadedApk(fileUri: string): Promise<boolean> {
  if (Platform.OS !== "android") return false;

  try {
    const contentUri = await FileSystem.getContentUriAsync(fileUri);
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: contentUri,
      flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
      type: "application/vnd.android.package-archive",
    });
    return true;
  } catch (error) {
    console.error("[UpdateService] Error launching APK package installer:", error);
    return false;
  }
}

/**
 * Downloads the OTA update bundle in the background without interrupting the user.
 */
export async function downloadAppUpdate(): Promise<boolean> {
  if (!Updates.isEnabled || Platform.OS === "web" || __DEV__) {
    return false;
  }

  try {
    const result = await Updates.fetchUpdateAsync();
    return result.isNew;
  } catch (error) {
    console.error("[UpdateService] Download OTA update error:", error);
    return false;
  }
}

/**
 * Restarts the app immediately to apply the downloaded OTA update.
 */
export async function applyUpdateAndRestart(): Promise<void> {
  if (!Updates.isEnabled || Platform.OS === "web" || __DEV__) {
    return;
  }

  try {
    // Give Android WindowManager a clean moment to finish dismissing any open dialogs
    await new Promise((resolve) => setTimeout(resolve, 250));
    await Updates.reloadAsync();
  } catch (error) {
    console.error("[UpdateService] Reload error:", error);
  }
}
