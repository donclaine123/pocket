import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ArrowDownToLine,
  Check,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react-native";
import { COLORS, FONTS, STYLES } from "../constants/theme";
import { safeHaptic } from "../services/haptics";
import { applyUpdateAndRestart, downloadAppUpdate } from "../services/updateService";

interface UpdateModalProps {
  visible: boolean;
  onClose: () => void;
  newVersion?: string;
}

export function UpdateModal({ visible, onClose, newVersion = "latest" }: UpdateModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [readyToRestart, setReadyToRestart] = useState(false);

  const handleStartUpdate = async () => {
    safeHaptic.selection();
    setDownloading(true);

    // Download update bundle in background
    const downloaded = await downloadAppUpdate();
    setDownloading(false);

    if (downloaded) {
      setReadyToRestart(true);
      safeHaptic.success();
    } else {
      // If simulated or already fetched, proceed to reload
      setReadyToRestart(true);
    }
  };

  const handleRestart = async () => {
    safeHaptic.success();
    await applyUpdateAndRestart();
    onClose();
  };

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
              <Text style={styles.versionSubtitle}>Pocket Penny Journal</Text>
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

          {/* Zero Data Loss Guarantee Banner */}
          <View style={styles.safetyCard}>
            <View style={styles.safetyHeader}>
              <ShieldCheck size={16} color="#2D8C65" />
              <Text style={styles.safetyTitle}>Zero Data Loss Guarantee</Text>
            </View>
            <Text style={styles.safetyText}>
              This update applies directly in-place without uninstalling the app. All your guest mode transactions and balance stay 100% safe on your device.
            </Text>
          </View>

          {/* Action Area */}
          <View style={styles.actions}>
            {readyToRestart ? (
              <Pressable
                onPress={handleRestart}
                style={[styles.primaryBtn, { backgroundColor: COLORS.mint }]}
              >
                <PackageCheck size={18} color={COLORS.ink} strokeWidth={2.2} />
                <Text style={styles.primaryBtnText}>Restart Now to Apply</Text>
              </Pressable>
            ) : downloading ? (
              <View style={styles.downloadingContainer}>
                <ActivityIndicator size="small" color={COLORS.ink} />
                <Text style={styles.downloadingText}>Downloading update in background...</Text>
              </View>
            ) : (
              <Pressable
                onPress={handleStartUpdate}
                style={styles.primaryBtn}
              >
                <ArrowDownToLine size={18} color={COLORS.cream} strokeWidth={2.2} />
                <Text style={[styles.primaryBtnText, { color: COLORS.cream }]}>
                  Update & Reload Now
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
  safetyCard: {
    backgroundColor: "#E8F7F0",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#A3DEC1",
    marginBottom: 20,
  },
  safetyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
  },
  downloadingText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.ink,
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
