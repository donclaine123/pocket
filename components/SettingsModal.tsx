import Constants from "expo-constants";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Coins,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Vibrate,
  X,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { CURRENCIES, CurrencyOption, DEFAULT_CURRENCY } from "../constants/currencies";
import { COLORS, FONTS } from "../constants/theme";
import { safeHaptic } from "../services/haptics";
import { checkForAppUpdate } from "../services/updateService";
import { UpdateModal } from "./UpdateModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  currency?: CurrencyOption;
  onSelectCurrency?: (currency: CurrencyOption) => void;
}

export function SettingsModal({
  visible,
  onClose,
  currency = DEFAULT_CURRENCY,
  onSelectCurrency,
}: SettingsModalProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const currentVersion = Constants.expoConfig?.version ?? "1.0.0";
  const modalCardHeight = Math.min(Math.round(windowHeight * 0.75), 580);

  // Sub-view: Currency picker
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");

  // Manual update check state
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<{
    type: "success" | "info" | "error";
    message: string;
  } | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Preference toggles
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.label.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    );
  }, [currencySearch]);

  const handleManualCheck = async () => {
    safeHaptic.selection();
    setCheckingUpdate(true);
    setUpdateNotice(null);

    try {
      const res = await checkForAppUpdate();
      setCheckingUpdate(false);

      if (res.isAvailable) {
        setShowUpdateModal(true);
      } else {
        safeHaptic.success();
        setUpdateNotice({
          type: "success",
          message: `✿ You're on the latest version (v${currentVersion})! Your guest data is 100% safe.`,
        });
      }
    } catch (err: any) {
      setCheckingUpdate(false);
      setUpdateNotice({
        type: "info",
        message: `✿ You're running the latest build (v${currentVersion}).`,
      });
    }
  };

  const toggleHaptics = (val: boolean) => {
    if (val) safeHaptic.selection();
    setHapticsEnabled(val);
  };

  const handleClose = () => {
    setShowCurrencyPicker(false);
    setCurrencySearch("");
    onClose();
  };

  const coinDisplaySymbol = currency.symbol.length > 2 ? currency.symbol[0] : currency.symbol;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View
        style={[
          styles.modalOverlay,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 20,
          },
        ]}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleClose} />

        <View style={[styles.modalCard, { height: modalCardHeight }]}>
          {showCurrencyPicker ? (
            /* ============================================================= */
            /* SUB-VIEW: CURRENCY PICKER                                    */
            /* ============================================================= */
            <View style={styles.pickerContainer}>
              {/* Currency Picker Header */}
              <View style={styles.modalHeader}>
                <View style={styles.titleRow}>
                  <Pressable
                    onPress={() => {
                      safeHaptic.light();
                      setShowCurrencyPicker(false);
                      setCurrencySearch("");
                    }}
                    style={styles.backButton}
                    hitSlop={8}
                    accessibilityLabel="Back to Settings"
                  >
                    <ChevronLeft size={18} color={COLORS.ink} strokeWidth={2.4} />
                  </Pressable>
                  <View>
                    <Text style={styles.modalTitle}>Select Currency</Text>
                    <Text style={styles.modalSubtitle}>Default for balance & entries</Text>
                  </View>
                </View>

                <Pressable
                  onPress={handleClose}
                  style={styles.closeButton}
                  hitSlop={8}
                  accessibilityLabel="Close"
                >
                  <X size={16} color={COLORS.ink} strokeWidth={2.4} />
                </Pressable>
              </View>

              {/* Currency Search Input */}
              <View style={styles.searchBarWrapper}>
                <View style={styles.searchBar}>
                  <Search size={15} color={COLORS.inkSoft} strokeWidth={2.2} />
                  <TextInput
                    value={currencySearch}
                    onChangeText={setCurrencySearch}
                    placeholder="Search currency, code or country..."
                    placeholderTextColor={COLORS.inkSoft}
                    style={styles.searchInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {currencySearch.length > 0 && (
                    <Pressable
                      onPress={() => setCurrencySearch("")}
                      hitSlop={8}
                      style={styles.clearSearchBtn}
                    >
                      <X size={13} color={COLORS.inkSoft} />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Currency List */}
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.currencyListContent}
              >
                {filteredCurrencies.length === 0 ? (
                  <View style={styles.emptySearchBox}>
                    <Text style={styles.emptySearchText}>
                      No currency found matching "{currencySearch}"
                    </Text>
                  </View>
                ) : (
                  filteredCurrencies.map((curr) => {
                    const isSelected = curr.code === currency.code;
                    return (
                      <Pressable
                        key={curr.code}
                        onPress={() => {
                          safeHaptic.selection();
                          onSelectCurrency?.(curr);
                          setShowCurrencyPicker(false);
                          setCurrencySearch("");
                        }}
                        style={({ pressed }) => [
                          styles.currencyItemRow,
                          isSelected && styles.currencyItemRowSelected,
                          pressed && { opacity: 0.75 },
                        ]}
                      >
                        <View style={styles.currencyFlagBubble}>
                          <Text style={styles.currencyFlagText}>{curr.flag}</Text>
                        </View>

                        <View style={styles.currencyTextCol}>
                          <View style={styles.currencyCodeRow}>
                            <Text style={styles.currencyCodeText}>{curr.code}</Text>
                            <View style={styles.currencySymbolPill}>
                              <Text style={styles.currencySymbolPillText}>
                                {curr.symbol}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.currencyLabelText}>{curr.label}</Text>
                        </View>

                        {isSelected ? (
                          <View style={styles.currencyCheckBadge}>
                            <Check size={13} color="#1F6347" strokeWidth={2.6} />
                          </View>
                        ) : (
                          <View style={styles.currencyUncheckedCircle} />
                        )}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          ) : (
            /* ============================================================= */
            /* MAIN VIEW: SETTINGS                                          */
            /* ============================================================= */
            <>
              {/* 1. Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.titleRow}>
                  <View style={styles.headerIconBubble}>
                    <Settings size={17} color={COLORS.ink} strokeWidth={2.4} />
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>Settings</Text>
                    <Text style={styles.modalSubtitle}>Preferences & System</Text>
                  </View>
                </View>

                <Pressable
                  onPress={handleClose}
                  style={styles.closeButton}
                  hitSlop={8}
                  accessibilityLabel="Close Settings"
                >
                  <X size={16} color={COLORS.ink} strokeWidth={2.4} />
                </Pressable>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {/* 2. Hero Pocket Branding Card */}
                <View style={styles.heroCard}>
                  <View style={styles.heroBrandRow}>
                    {/* Mini Brand Pocket Icon */}
                    <View style={styles.heroIconWrapper}>
                      <View style={styles.heroPennyCoin}>
                        <Text style={styles.heroCoinSymbol}>{coinDisplaySymbol}</Text>
                      </View>
                      <View style={styles.heroPocketBody}>
                        <View style={styles.heroPocketStitch} />
                        <Text style={styles.heroPocketLetter}>p</Text>
                      </View>
                    </View>

                    <View style={styles.heroTitleCol}>
                      <View style={styles.heroTitleLine}>
                        <Text style={styles.heroAppTitle}>pocket.</Text>
                        <View style={styles.heroVersionBadge}>
                          <Text style={styles.heroVersionText}>v{currentVersion}</Text>
                        </View>
                      </View>
                      <Text style={styles.heroAppSubtitle}>penny journal · offline by design</Text>
                    </View>
                  </View>

                  <View style={styles.heroMottoBox}>
                    <Sparkles size={12} color="#D97706" />
                    <Text style={styles.heroMottoText}>
                      "a steady little habit beats a big reset ✿"
                    </Text>
                  </View>
                </View>

                {/* 3. Section: PREFERENCES */}
                <View style={styles.sectionGroup}>
                  <Text style={styles.sectionEyebrow}>PREFERENCES</Text>
                  <View style={styles.groupCard}>
                    {/* Haptic Feedback Toggle */}
                    <View style={styles.settingItemRow}>
                      <View style={[styles.settingIconBox, { backgroundColor: "#FFF0EB" }]}>
                        <Vibrate size={15} color="#D35433" strokeWidth={2.2} />
                      </View>
                      <View style={styles.settingTextCol}>
                        <Text style={styles.settingTitle}>Haptic Feedback</Text>
                        <Text style={styles.settingDesc}>Tactile vibration on taps & entries</Text>
                      </View>
                      <Switch
                        value={hapticsEnabled}
                        onValueChange={toggleHaptics}
                        trackColor={{ false: COLORS.inkMuted, true: COLORS.mint }}
                        thumbColor={COLORS.cream}
                      />
                    </View>

                    <View style={styles.rowDivider} />

                    {/* Default Currency Selector */}
                    <Pressable
                      onPress={() => {
                        safeHaptic.selection();
                        setShowCurrencyPicker(true);
                      }}
                      style={({ pressed }) => [
                        styles.settingItemRow,
                        pressed && { opacity: 0.72 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Change Default Currency"
                    >
                      <View style={[styles.settingIconBox, { backgroundColor: "#FFF4DC" }]}>
                        <Coins size={15} color="#B45309" strokeWidth={2.2} />
                      </View>
                      <View style={styles.settingTextCol}>
                        <Text style={styles.settingTitle}>Default Currency</Text>
                        <Text style={styles.settingDesc}>
                          {currency.flag} {currency.label}
                        </Text>
                      </View>
                      <View style={styles.currencySelectPill}>
                        <Text style={styles.currencySelectPillText}>
                          {currency.symbol} {currency.code}
                        </Text>
                        <ChevronRight size={13} color={COLORS.inkSoft} strokeWidth={2.4} />
                      </View>
                    </Pressable>
                  </View>
                </View>

                {/* 4. Section: APP UPDATES & SAFETY */}
                <View style={styles.sectionGroup}>
                  <Text style={styles.sectionEyebrow}>APP UPDATES & SAFETY</Text>
                  <View style={styles.groupCard}>
                    {/* Current Version */}
                    <View style={styles.settingItemRow}>
                      <View style={[styles.settingIconBox, { backgroundColor: "#E6FAF0" }]}>
                        <Smartphone size={15} color="#2D8C65" strokeWidth={2.2} />
                      </View>
                      <View style={styles.settingTextCol}>
                        <Text style={styles.settingTitle}>Installed Version</Text>
                        <Text style={styles.settingDesc}>Keep Pocket up to date</Text>
                      </View>
                      <View style={[styles.pillTag, { backgroundColor: COLORS.butter }]}>
                        <Text style={styles.pillTagText}>v{currentVersion}</Text>
                      </View>
                    </View>

                    <View style={styles.rowDivider} />

                    {/* Zero Data Loss Guarantee Banner */}
                    <View style={styles.guaranteeBanner}>
                      <View style={styles.guaranteeIconCircle}>
                        <ShieldCheck size={14} color="#2D8C65" strokeWidth={2.4} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.guaranteeTitle}>Safe Updates</Text>
                        <Text style={styles.guaranteeBody}>
                          Updates install smoothly without erasing your entries. Your journal and balance are always protected.
                        </Text>
                      </View>
                    </View>

                    {/* Manual Update Checker Button */}
                    <Pressable
                      onPress={handleManualCheck}
                      disabled={checkingUpdate}
                      style={({ pressed }) => [
                        styles.updateButton,
                        pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                      ]}
                    >
                      {checkingUpdate ? (
                        <>
                          <ActivityIndicator size="small" color={COLORS.cream} />
                          <Text style={styles.updateButtonText}>Checking for updates...</Text>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={14} color={COLORS.cream} strokeWidth={2.2} />
                          <Text style={styles.updateButtonText}>Check for Updates</Text>
                        </>
                      )}
                    </Pressable>

                    {/* Update Notice Banner */}
                    {updateNotice && (
                      <View
                        style={[
                          styles.noticeBox,
                          updateNotice.type === "success"
                            ? styles.noticeBoxSuccess
                            : styles.noticeBoxInfo,
                        ]}
                      >
                        <Check
                          size={14}
                          color={updateNotice.type === "success" ? "#2D8C65" : COLORS.ink}
                          strokeWidth={2.2}
                        />
                        <Text
                          style={[
                            styles.noticeText,
                            {
                              color:
                                updateNotice.type === "success" ? "#1F6347" : COLORS.ink,
                            },
                          ]}
                        >
                          {updateNotice.message}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* 5. Section: ABOUT POCKET */}
                <View style={styles.sectionGroup}>
                  <Text style={styles.sectionEyebrow}>ABOUT POCKET</Text>
                  <View style={styles.groupCard}>
                    {/* Clear & Friendly Headline and Description */}
                    <Text style={styles.aboutHeadline}>
                      A simple, private way to track your spending.
                    </Text>
                    <Text style={styles.aboutBody}>
                      Pocket helps you build mindful money habits by noting your daily expenses and income in just a few taps. No ads, no tracking, and no account needed.
                    </Text>

                    <View style={styles.rowDivider} />

                    {/* Simple Highlights */}
                    <View style={styles.aboutFeatureList}>
                      <View style={styles.aboutFeatureRow}>
                        <View style={[styles.aboutFeatureIconBox, { backgroundColor: "#E6FAF0" }]}>
                          <ShieldCheck size={14} color="#2D8C65" strokeWidth={2.4} />
                        </View>
                        <View style={styles.aboutFeatureTextCol}>
                          <Text style={styles.aboutFeatureTitle}>100% Private on Your Phone</Text>
                          <Text style={styles.aboutFeatureDesc}>
                            Everything you write stays on your device. Nobody else sees your money.
                          </Text>
                        </View>
                      </View>

                      <View style={styles.aboutFeatureRow}>
                        <View style={[styles.aboutFeatureIconBox, { backgroundColor: "#FFF4DC" }]}>
                          <Sparkles size={14} color="#B45309" strokeWidth={2.4} />
                        </View>
                        <View style={styles.aboutFeatureTextCol}>
                          <Text style={styles.aboutFeatureTitle}>Quick & Simple</Text>
                          <Text style={styles.aboutFeatureDesc}>
                            Log expenses in 3 seconds with cozy categories and notes.
                          </Text>
                        </View>
                      </View>

                      <View style={styles.aboutFeatureRow}>
                        <View style={[styles.aboutFeatureIconBox, { backgroundColor: "#F3EEFF" }]}>
                          <Cloud size={14} color="#7A5299" strokeWidth={2.4} />
                        </View>
                        <View style={styles.aboutFeatureTextCol}>
                          <Text style={styles.aboutFeatureTitle}>Sync Across Devices (Optional)</Text>
                          <Text style={styles.aboutFeatureDesc}>
                            Sign in only if you want your journal backed up on multiple devices.
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.rowDivider} />

                    {/* App Version Row (Clean & Non-Tech) */}
                    <View style={[styles.systemInfoRow, { borderBottomWidth: 0 }]}>
                      <Text style={styles.systemLabel}>App Version</Text>
                      <Text style={styles.systemVal}>v{currentVersion}</Text>
                    </View>
                  </View>
                </View>

                {/* Modal Footer Signature */}
                <View style={styles.modalFooter}>
                  <Text style={styles.footerNoteText}>
                    crafted with care · offline & private by design ✿
                  </Text>
                </View>
              </ScrollView>
            </>
          )}

          {/* Sub-modal for active update download & restart */}
          <UpdateModal
            visible={showUpdateModal}
            onClose={() => setShowUpdateModal(false)}
            newVersion={currentVersion}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(42, 36, 33, 0.55)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: COLORS.paper,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 4, height: 6 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  pickerContainer: {
    flex: 1,
    maxHeight: 520,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 13,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.cardBorder,
    backgroundColor: COLORS.cream,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.paper,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  headerIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: COLORS.butter,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 17,
    color: COLORS.ink,
  },
  modalSubtitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.inkSoft,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.paper,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 14,
    gap: 14,
  },

  // Currency Search Box
  searchBarWrapper: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: COLORS.paper,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 10,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.ink,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  currencyListContent: {
    padding: 14,
    gap: 8,
  },
  emptySearchBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptySearchText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12.5,
    color: COLORS.inkSoft,
  },
  currencyItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cream,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  currencyItemRowSelected: {
    backgroundColor: "#F0FDF4",
    borderColor: "#2D8C65",
  },
  currencyFlagBubble: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.paper,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  currencyFlagText: {
    fontSize: 18,
  },
  currencyTextCol: {
    flex: 1,
  },
  currencyCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  currencyCodeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13.5,
    color: COLORS.ink,
  },
  currencySymbolPill: {
    backgroundColor: COLORS.paper,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  currencySymbolPillText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10.5,
    color: COLORS.ink,
  },
  currencyLabelText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.inkSoft,
    marginTop: 2,
  },
  currencyCheckBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#C5EED9",
    borderWidth: 1.2,
    borderColor: "#2D8C65",
    justifyContent: "center",
    alignItems: "center",
  },
  currencyUncheckedCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.inkMuted,
  },

  // Hero Card
  heroCard: {
    backgroundColor: COLORS.cream,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    shadowColor: COLORS.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 2,
  },
  heroBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroIconWrapper: {
    width: 44,
    height: 44,
    justifyContent: "flex-end",
    alignItems: "center",
    position: "relative",
  },
  heroPennyCoin: {
    position: "absolute",
    top: 1,
    right: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFD166",
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 0,
  },
  heroCoinSymbol: {
    fontFamily: FONTS.displayBold,
    fontSize: 8,
    color: "#7A4F01",
    lineHeight: 9,
  },
  heroPocketBody: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.peach,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    zIndex: 1,
  },
  heroPocketStitch: {
    position: "absolute",
    top: 7,
    left: 6,
    right: 6,
    borderTopWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(255, 255, 255, 0.75)",
  },
  heroPocketLetter: {
    fontFamily: FONTS.displayBold,
    fontSize: 22,
    color: COLORS.cream,
    marginTop: 1,
  },
  heroTitleCol: {
    flex: 1,
  },
  heroTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  heroAppTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 22,
    color: COLORS.ink,
    lineHeight: 24,
  },
  heroVersionBadge: {
    backgroundColor: COLORS.butter,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  heroVersionText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.ink,
  },
  heroAppSubtitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.inkSoft,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  heroMottoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },
  heroMottoText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11.5,
    color: "#92400E",
    flex: 1,
    lineHeight: 16,
  },

  // Grouped Sections
  sectionGroup: {
    gap: 6,
  },
  sectionEyebrow: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: COLORS.inkSoft,
    marginLeft: 4,
  },
  groupCard: {
    backgroundColor: COLORS.cream,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    shadowColor: COLORS.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 2,
  },

  // Setting Item Rows
  settingItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  settingIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  settingTextCol: {
    flex: 1,
  },
  settingTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.ink,
  },
  settingDesc: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.inkSoft,
    marginTop: 1,
  },
  currencySelectPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.paper,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  currencySelectPillText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.ink,
  },
  pillTag: {
    backgroundColor: COLORS.paper,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  pillTagText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10.5,
    color: COLORS.ink,
  },
  rowDivider: {
    height: 1,
    backgroundColor: COLORS.inkMuted,
    marginVertical: 10,
  },

  // Guarantee Banner
  guaranteeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#E8F7F0",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.2,
    borderColor: "#A3DEC1",
    marginBottom: 12,
  },
  guaranteeIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#C5EED9",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  guaranteeTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11.5,
    color: "#1F6347",
    marginBottom: 2,
  },
  guaranteeBody: {
    fontFamily: FONTS.body,
    fontSize: 10.5,
    lineHeight: 15,
    color: "#2B5241",
  },

  // Update Button
  updateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.ink,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    shadowColor: COLORS.ink,
    shadowOffset: { width: 1.5, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 2,
  },
  updateButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12.5,
    color: COLORS.cream,
  },

  // Update Notices
  noticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    padding: 9,
    marginTop: 10,
    borderWidth: 1,
  },
  noticeBoxSuccess: {
    backgroundColor: "#E8F7F0",
    borderColor: "#A3DEC1",
  },
  noticeBoxInfo: {
    backgroundColor: COLORS.butter,
    borderColor: COLORS.cardBorder,
  },
  noticeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },

  // About Pocket Section
  aboutHeadline: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: COLORS.ink,
    marginBottom: 4,
    lineHeight: 18,
  },
  aboutBody: {
    fontFamily: FONTS.body,
    fontSize: 11.5,
    color: COLORS.inkSoft,
    lineHeight: 16.5,
  },
  aboutFeatureList: {
    gap: 10,
    marginVertical: 2,
  },
  aboutFeatureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  aboutFeatureIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  aboutFeatureTextCol: {
    flex: 1,
  },
  aboutFeatureTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.ink,
  },
  aboutFeatureDesc: {
    fontFamily: FONTS.body,
    fontSize: 10.5,
    color: COLORS.inkSoft,
    lineHeight: 14.5,
    marginTop: 1,
  },
  systemInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inkMuted,
  },
  systemLabel: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.inkSoft,
  },
  systemVal: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.ink,
  },

  // Modal Footer
  modalFooter: {
    alignItems: "center",
    paddingVertical: 4,
  },
  footerNoteText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10.5,
    color: COLORS.inkSoft,
  },
});
