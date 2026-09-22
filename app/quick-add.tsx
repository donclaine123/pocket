import React, { useEffect, useState } from "react";
import {
  AppState,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Check, Sparkles, X } from "lucide-react-native";
import { COLORS, FONTS, STYLES } from "../constants/theme";
import { safeHaptic } from "../services/haptics";
import {
  CategoryKey,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  Txn,
  TxnType,
} from "../types/transaction";
import { CurrencyOption, DEFAULT_CURRENCY } from "../constants/currencies";
import {
  loadSavedCurrency,
  loadTransactions,
  saveTransactions,
} from "../services/storage";
import { refreshAllWidgets } from "../services/widgetSync";

export default function QuickAddScreen() {
  const { fromWidget } = useLocalSearchParams<{ fromWidget?: string }>();
  const [type, setType] = useState<TxnType>("expense");
  const [amountStr, setAmountStr] = useState("");
  const [category, setCategory] = useState<CategoryKey>("food_beverage");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState<CurrencyOption>(DEFAULT_CURRENCY);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  // Track keyboard visibility so back button can dismiss keyboard first without window jitter
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "android" ? "keyboardDidShow" : "keyboardWillShow",
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "android" ? "keyboardDidHide" : "keyboardWillHide",
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Load user's preferred currency and sync widgets on mount
  useEffect(() => {
    loadSavedCurrency().then((curr) => {
      if (curr) setCurrency(curr);
    });
    refreshAllWidgets();
  }, []);

  // Reset route to home when app is backgrounded so reopening app from launcher opens home
  useEffect(() => {
    if (fromWidget === "true") {
      const sub = AppState.addEventListener("change", (nextState) => {
        if (nextState === "background") {
          router.replace("/");
        }
      });
      return () => sub.remove();
    }
  }, [fromWidget]);

  // Exit handler: closes directly to Android home screen without staying trapped in quick-add
  const handleExit = () => {
    Keyboard.dismiss();
    safeHaptic.light();
    if (Platform.OS === "android") {
      if (fromWidget === "true") {
        router.replace("/");
        setTimeout(() => {
          BackHandler.exitApp();
        }, 100);
      } else {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/");
        }
      }
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/");
      }
    }
  };

  // Intercept Android hardware back button cleanly
  useEffect(() => {
    if (Platform.OS === "android") {
      const onBackPress = () => {
        if (isKeyboardVisible) {
          Keyboard.dismiss();
          return true;
        }
        handleExit();
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => sub.remove();
    }
  }, [isKeyboardVisible, fromWidget]);

  const categories = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleAddPresetAmount = (addVal: number) => {
    safeHaptic.light();
    const current = parseFloat(amountStr) || 0;
    const next = current + addVal;
    setAmountStr(next.toString());
  };

  const handleSave = async () => {
    const numericAmount = parseFloat(amountStr);
    if (!numericAmount || numericAmount <= 0) {
      safeHaptic.warning();
      return;
    }

    setSaving(true);
    safeHaptic.selection();

    try {
      const existing = await loadTransactions();
      const newTxn: Txn = {
        id: `qa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type,
        amount: numericAmount,
        category,
        note: note.trim(),
        date: new Date().toISOString(),
      };

      await saveTransactions([newTxn, ...existing]);
      safeHaptic.success();

      // Exit directly to Android home screen without staying trapped in quick-add
      if (Platform.OS === "android") {
        if (fromWidget === "true") {
          router.replace("/");
          setTimeout(() => {
            BackHandler.exitApp();
          }, 100);
        } else {
          handleExit();
        }
      } else {
        handleExit();
      }
    } catch (err) {
      console.error("[QuickAdd] Error saving:", err);
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <Pressable style={styles.backdrop} onPress={handleExit} />

      <View style={[styles.card, STYLES.card]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconBubble}>
            <Sparkles size={18} color={COLORS.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Quick Entry ✿</Text>
            <Text style={styles.subtitle}>Pocket Widget Fast Add</Text>
          </View>
          <Pressable hitSlop={8} onPress={handleExit} style={styles.closeBtn}>
            <X size={16} color={COLORS.ink} />
          </Pressable>
        </View>

        {/* Type Toggle: Expense / Income */}
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => {
              safeHaptic.selection();
              setType("expense");
              setCategory("food_beverage");
            }}
            style={[
              styles.toggleBtn,
              type === "expense" && styles.toggleBtnActiveExpense,
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                type === "expense" && styles.toggleTextActive,
              ]}
            >
              Expense
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              safeHaptic.selection();
              setType("income");
              setCategory("salary");
            }}
            style={[
              styles.toggleBtn,
              type === "income" && styles.toggleBtnActiveIncome,
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                type === "income" && styles.toggleTextActive,
              ]}
            >
              Income
            </Text>
          </Pressable>
        </View>

        {/* Amount Input with user's preferred currency symbol */}
        <View style={styles.amountBox}>
          <Text style={styles.currencyPrefix}>{currency.symbol}</Text>
          <TextInput
            style={styles.amountInput}
            value={amountStr}
            onChangeText={setAmountStr}
            placeholder="0.00"
            placeholderTextColor={COLORS.inkSoft}
            keyboardType="decimal-pad"
            autoFocus
          />
        </View>

        {/* Quick Amount Steppers with user's currency */}
        <View style={styles.presetRow}>
          {[5, 10, 20, 50].map((val) => (
            <Pressable
              key={val}
              onPress={() => handleAddPresetAmount(val)}
              style={styles.presetChip}
            >
              <Text style={styles.presetChipText}>
                +{currency.symbol}{val}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Category Pills (Horizontal Scroll) */}
        <Text style={styles.sectionLabel}>CATEGORY</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.categoryScroll}
        >
          {categories.map((c) => {
            const isSelected = category === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => {
                  safeHaptic.selection();
                  setCategory(c.key);
                }}
                style={[
                  styles.categoryChip,
                  isSelected && styles.categoryChipSelected,
                ]}
              >
                <Text style={styles.categoryEmoji}>{c.emoji}</Text>
                <Text
                  style={[
                    styles.categoryText,
                    isSelected && styles.categoryTextSelected,
                  ]}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Optional Note Input */}
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional, e.g. Coffee with Sam)"
          placeholderTextColor={COLORS.inkSoft}
          maxLength={50}
        />

        {/* Save Action Button */}
        <Pressable
          onPress={handleSave}
          disabled={saving || !amountStr}
          style={[
            styles.saveButton,
            (!amountStr || saving) && { opacity: 0.5 },
          ]}
        >
          <Check size={18} color={COLORS.cream} strokeWidth={2.4} />
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : "Save Entry"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(51, 47, 44, 0.45)",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "android" ? 16 : 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: COLORS.cream,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  iconBubble: {
    width: 40,
    height: 40,
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
  subtitle: {
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
  toggleRow: {
    flexDirection: "row",
    backgroundColor: COLORS.paper,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    padding: 3,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  toggleBtnActiveExpense: {
    backgroundColor: COLORS.peach,
  },
  toggleBtnActiveIncome: {
    backgroundColor: COLORS.mint,
  },
  toggleText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.inkSoft,
  },
  toggleTextActive: {
    color: COLORS.ink,
  },
  amountBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.paper,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 12,
  },
  currencyPrefix: {
    fontFamily: FONTS.displayBold,
    fontSize: 26,
    color: COLORS.ink,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontFamily: FONTS.displayBold,
    fontSize: 26,
    color: COLORS.ink,
    padding: 0,
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    flex: 1,
    backgroundColor: COLORS.butter,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    paddingVertical: 6,
    alignItems: "center",
  },
  presetChipText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.ink,
  },
  sectionLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.inkSoft,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  categoryScroll: {
    gap: 8,
    paddingBottom: 12,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.paper,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryChipSelected: {
    backgroundColor: COLORS.butter,
    borderColor: COLORS.ink,
  },
  categoryEmoji: {
    fontSize: 14,
  },
  categoryText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.inkSoft,
  },
  categoryTextSelected: {
    fontFamily: FONTS.bodyBold,
    color: COLORS.ink,
  },
  noteInput: {
    backgroundColor: COLORS.paper,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.ink,
    marginBottom: 16,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.ink,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
  },
  saveButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.cream,
  },
});
