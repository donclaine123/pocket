import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ArrowDownToLine,
  Check,
  Download,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react-native";
import { COLORS, FONTS, STYLES } from "../constants/theme";
import { safeHaptic } from "../services/haptics";
import {
  applyUpdateAndRestart,
  downloadApkWithProgress,
  downloadAppUpdate,
  installDownloadedApk,
} from "../services/updateService";

interface UpdateModalProps {
  visible: boolean;
  onClose: () => void;
  newVersion?: string;
  updateType?: "apk" | "ota" | "none";
  apkDownloadUrl?: string;
  releaseNotes?: string;
}

export function UpdateModal({
  visible,
  onClose,
  newVersion = "latest",
  updateType = "ota",
  apkDownloadUrl,
  releaseNotes,
}: UpdateModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [readyToRestart, setReadyToRestart] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [downloadedApkUri, setDownloadedApkUri] = useState<string | null>(null);

  const handleStartUpdate = async () => {
    safeHaptic.selection();
    setDownloading(true);
    setProgress(0);

    const shouldDownloadApk = updateType === "apk" || Boolean(apkDownloadUrl);
    if (shouldDownloadApk && apkDownloadUrl) {
      // 1. In-App APK Download & Install
      const fileUri = await downloadApkWithProgress(apkDownloadUrl, (ratio) => {
        setProgress(ratio);
      });
      setDownloading(false);

      if (fileUri) {
        setDownloadedApkUri(fileUri);
        safeHaptic.success();
        // Cleanly dismiss modal before launching Android system package installer
        onClose();
        setTimeout(async () => {
          await installDownloadedApk(fileUri);
        }, 350);
      }
    } else {
      // 2. Over-The-Air JavaScript Update
      const downloaded = await downloadAppUpdate();
      setDownloading(false);

      if (downloaded) {
        setReadyToRestart(true);
        safeHaptic.success();
      } else {
        setReadyToRestart(true);
      }
    }
  };

  const handleInstallApkAgain = async () => {
    if (downloadedApkUri) {
      safeHaptic.selection();
      onClose();
      setTimeout(async () => {
        await installDownloadedApk(downloadedApkUri);
      }, 350);
    }
  };

  const handleRestart = async () => {
    safeHaptic.success();
    setIsRestarting(true);
    // Dismiss modal first to unmount native Android Dialog DecorView, preventing WindowLeaked crashes
    onClose();
    setTimeout(async () => {
      await applyUpdateAndRestart();
    }, 400);
  };

  const isApk = updateType === "apk" || Boolean(apkDownloadUrl);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, STYLES.card]}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <View style={styles.iconBubble}>
              <Sparkles size={20} color={COLORS.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Update Available! ✿</Text>
              <Text style={styles.versionSubtitle}>
                Pocket Penny Journal · v{newVersion}
              </Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => {
                safeHaptic.light();
                onClose();
              }}
              style={styles.closeBtn}
            >
              <X size={16} color={COLORS.ink} />
            </Pressable>
          </View>

          {/* Release Notes excerpt if available */}
          {Boolean(releaseNotes) && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesTitle}>What's New in v{newVersion}:</Text>
              <ScrollView style={styles.notesScroll} nestedScrollEnabled>
                <Text style={styles.notesText}>{releaseNotes}</Text>
              </ScrollView>
            </View>
          )}

          {/* Zero Data Loss Guarantee Banner */}
          <View style={styles.safetyCard}>
            <View style={styles.safetyHeader}>
              <ShieldCheck size={16} color="#2D8C65" />
              <Text style={styles.safetyTitle}>Zero Data Loss Guarantee</Text>
            </View>
            <Text style={styles.safetyText}>
              {isApk
                ? "This updates your app directly in-place. All your guest transactions, SQLite journal, and settings remain 100% safe."
                : "This update applies directly in-place without uninstalling the app. All your guest transactions and balance stay 100% safe."}
            </Text>
          </View>

          {/* Action Area */}
          <View style={styles.actions}>
            {isApk && downloadedApkUri ? (
              <Pressable
                onPress={handleInstallApkAgain}
                style={[styles.primaryBtn, { backgroundColor: COLORS.mint }]}
              >
                <PackageCheck size={18} color={COLORS.ink} strokeWidth={2.2} />
                <Text style={styles.primaryBtnText}>Launch Installer to Finish</Text>
              </Pressable>
            ) : !isApk && readyToRestart ? (
              <Pressable
                onPress={handleRestart}
                style={[styles.primaryBtn, { backgroundColor: COLORS.mint }]}
              >
                <PackageCheck size={18} color={COLORS.ink} strokeWidth={2.2} />
                <Text style={styles.primaryBtnText}>Restart Now to Apply</Text>
              </Pressable>
            ) : downloading ? (
              <View style={styles.downloadingContainer}>
                <View style={styles.progressRow}>
                  <ActivityIndicator size="small" color={COLORS.ink} />
                  <Text style={styles.downloadingText}>
                    {isApk
                      ? `Downloading APK (${Math.round(progress * 100)}%)...`
                      : "Downloading update in background..."}
                  </Text>
                </View>
                {isApk && (
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.round(progress * 100)}%` },
                      ]}
                    />
                  </View>
                )}
              </View>
            ) : (
              <Pressable
                onPress={handleStartUpdate}
                style={styles.primaryBtn}
              >
                {isApk ? (
                  <Download size={18} color={COLORS.cream} strokeWidth={2.2} />
                ) : (
                  <ArrowDownToLine size={18} color={COLORS.cream} strokeWidth={2.2} />
                )}
                <Text style={[styles.primaryBtnText, { color: COLORS.cream }]}>
                  {isApk ? "Download & Install APK" : "Update & Reload Now"}
                </Text>
              </Pressable>
            )}

            {!downloading && (
              <Pressable
                onPress={() => {
                  safeHaptic.light();
                  onClose();
                }}
                style={styles.laterBtn}
              >
                <Text style={styles.laterBtnText}>
                  {readyToRestart ? "Later (Apply on next launch)" : "Later"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(51, 47, 44, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: COLORS.cream,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    shadowColor: COLORS.ink,
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.butter,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontFamily: FONTS.displayBold,
    fontSize: 18,
    color: COLORS.ink,
  },
  versionSubtitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.inkSoft,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.inkMuted,
  },
  notesContainer: {
    backgroundColor: COLORS.paper,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    marginBottom: 12,
  },
  notesTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.ink,
    marginBottom: 4,
  },
  notesScroll: {
    maxHeight: 90,
  },
  notesText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.inkSoft,
  },
  safetyCard: {
    backgroundColor: "#E8F7F0",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#A3DEC1",
    marginBottom: 16,
  },
  safetyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  safetyTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: "#1F6347",
  },
  safetyText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 17,
    color: "#2B5241",
  },
  actions: {
    gap: 10,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.ink,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    shadowColor: COLORS.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  primaryBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.ink,
  },
  downloadingContainer: {
    paddingVertical: 8,
    gap: 8,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  downloadingText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.ink,
  },
  progressBarTrack: {
    width: "100%",
    height: 8,
    backgroundColor: COLORS.cardBorder,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.mint,
    borderRadius: 4,
  },
  laterBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  laterBtnText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.inkSoft,
    textDecorationLine: "underline",
  },
});

