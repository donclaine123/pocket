// Pocket Penny Journal - High Scalability FlashList Architecture
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Cloud,
  Edit2,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sun,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { COLORS, FONTS, STYLES } from "../constants/theme";
import { CloudSyncModal } from "../components/CloudSyncModal";
import { SettingsModal } from "../components/SettingsModal";
import { UpdateModal } from "../components/UpdateModal";
import { supabase } from "../database/supabase";
import { FlashList } from "@shopify/flash-list";
import { checkForAppUpdate } from "../services/updateService";
import {
  MonthArchive,
  TimeframeMode,
  buildMonthArchives,
  getDayRange,
  getMonthRange,
  getWeekRange,
  groupTransactionsByDate,
  isDateInRange,
  toISODate,
} from "../services/dateUtils";
import { safeHaptic } from "../services/haptics";
import {
  clearTransactions,
  deleteTransaction,
  loadSavedCurrency,
  loadTransactions,
  saveSavedCurrency,
  saveTransactions,
} from "../services/storage";
import { CurrencyOption, DEFAULT_CURRENCY } from "../constants/currencies";
import {
  CATEGORIES,
  Category,
  CategoryKey,
  Txn,
  TxnType,
} from "../types/transaction";

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getTodayISO(): string {
  return toISODate(new Date());
}

function getYesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toISODate(d);
}

function getCategoryColor(bg: Category["bg"]) {
  switch (bg) {
    case "peach":
      return { bg: COLORS.peach, text: COLORS.cream };
    case "mint":
      return { bg: COLORS.mint, text: COLORS.ink };
    case "lavender":
      return { bg: COLORS.lavender, text: COLORS.ink };
    case "butter":
    default:
      return { bg: COLORS.butter, text: COLORS.ink };
  }
}

type FeedItem =
  | {
      type: "header";
      id: string;
      date: string;
      displayDate: string;
      netFlow: number;
    }
  | {
      type: "txn";
      id: string;
      txn: Txn;
    }
  | {
      type: "archive";
      id: string;
      archive: MonthArchive;
    };

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isCompact = windowWidth < 360;
  const isVeryCompact = windowWidth < 340;
  const horizontalPad = isCompact ? 12 : 20;

  const [txns, setTxns] = useState<Txn[]>([]);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<any>(null);

  // Timeframe & Period Navigation
  const [timeframeMode, setTimeframeMode] = useState<TimeframeMode>("month");
  const [periodOffset, setPeriodOffset] = useState<number>(0);

  // Filters
  const [selectedTag, setSelectedTag] = useState<CategoryKey | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<TxnType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Modal State (Create / Edit)
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTxnId, setEditingTxnId] = useState<string | null>(null);
  const [formType, setFormType] = useState<TxnType>("expense");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState<CategoryKey>("coffee");
  const [formNote, setFormNote] = useState("");
  const [formDate, setFormDate] = useState(getTodayISO());
  const [amountError, setAmountError] = useState<string | null>(null);

  // Opening Scene State & Animations
  const [showOpeningScene, setShowOpeningScene] = useState(true);
  const fadeAnim = useState(() => new Animated.Value(0))[0];
  const scaleAnim = useState(() => new Animated.Value(0.85))[0];
  const floatAnim = useState(() => new Animated.Value(0))[0];
  const progressAnim = useState(() => new Animated.Value(0))[0];

  // In-App Confirmation Dialog States (Works reliably on Web, iOS, Android)
  const [deleteConfirmTxn, setDeleteConfirmTxn] = useState<Txn | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [cloudModalMode, setCloudModalMode] = useState<
    "signin" | "signup" | "forgot" | "new_password"
  >("signin");
  const [cloudModalError, setCloudModalError] = useState<string | null>(null);

  // In-App OTA Auto-Update State (Zero Data Loss)
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Currency Preference (Defaults to PHP, persists to local storage)
  const [currency, setCurrency] = useState<CurrencyOption>(DEFAULT_CURRENCY);

  useEffect(() => {
    loadSavedCurrency().then((saved) => {
      if (saved) setCurrency(saved);
    });
  }, []);

  const handleSelectCurrency = (newCurrency: CurrencyOption) => {
    setCurrency(newCurrency);
    saveSavedCurrency(newCurrency);
  };

  // Check for updates silently in the background on startup
  useEffect(() => {
    checkForAppUpdate().then((res) => {
      if (res.isAvailable) {
        setShowUpdateModal(true);
      }
    });
  }, []);

  // Animate Opening Scene entrance & Auto-redirect after ~2.2s
  useEffect(() => {
    if (showOpeningScene) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.85);
      progressAnim.setValue(0);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 2100,
          useNativeDriver: false,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(floatAnim, {
              toValue: -6,
              duration: 1800,
              useNativeDriver: true,
            }),
            Animated.timing(floatAnim, {
              toValue: 0,
              duration: 1800,
              useNativeDriver: true,
            }),
          ])
        ),
      ]).start();

      // Automatically redirect after ~2.2 seconds
      const autoRedirectTimer = setTimeout(() => {
        handleEnterJournal();
      }, 2200);

      return () => clearTimeout(autoRedirectTimer);
    }
  }, [showOpeningScene]);

  const handleEnterJournal = () => {
    safeHaptic.success();
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowOpeningScene(false);
    });
  };

  // Handle Password Recovery & Expired Link URLs (Web & Mobile APK)
  useEffect(() => {
    // 1. Web URL check
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      const fullUrl = hash + search;

      if (
        fullUrl.includes("otp_expired") ||
        fullUrl.includes("Email+link+is+invalid+or+has+expired") ||
        fullUrl.includes("error_code=otp_expired")
      ) {
        try {
          window.history.replaceState(null, "", window.location.pathname);
        } catch {}
        setCloudModalMode("forgot");
        setCloudModalError(
          "This password reset link has expired or was already used. Please enter your email below to request a fresh one."
        );
        setShowCloudModal(true);
      } else if (
        fullUrl.includes("type=recovery") ||
        fullUrl.includes("access_token=") ||
        fullUrl.includes("code=")
      ) {
        const rawParams = hash.replace(/^#/, "") || search.replace(/^\?/, "");
        const params = new URLSearchParams(rawParams);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const code = params.get("code");

        if (accessToken && refreshToken) {
          supabase.auth
            .setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            .then(() => {
              setCloudModalMode("new_password");
              setCloudModalError(null);
              setShowCloudModal(true);
            })
            .catch(() => {
              setCloudModalMode("new_password");
              setCloudModalError(null);
              setShowCloudModal(true);
            });
        } else if (code) {
          supabase.auth
            .exchangeCodeForSession(code)
            .then(() => {
              setCloudModalMode("new_password");
              setCloudModalError(null);
              setShowCloudModal(true);
            })
            .catch(() => {
              setCloudModalMode("new_password");
              setCloudModalError(null);
              setShowCloudModal(true);
            });
        } else {
          setCloudModalMode("new_password");
          setCloudModalError(null);
          setShowCloudModal(true);
        }
      }
    }

    // 2. Mobile deep link check (APK: pocket://reset-password#access_token=...)
    const handleDeepUrl = (url: string) => {
      const parsed = Linking.parse(url);
      const q = parsed.queryParams || {};
      const accessToken = (q.access_token as string) || null;
      const refreshToken = (q.refresh_token as string) || null;
      const code = (q.code as string) || null;

      if (accessToken && refreshToken) {
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(() => {
            setCloudModalMode("new_password");
            setCloudModalError(null);
            setShowCloudModal(true);
          });
      } else if (code) {
        supabase.auth.exchangeCodeForSession(code).then(() => {
          setCloudModalMode("new_password");
          setCloudModalError(null);
          setShowCloudModal(true);
        });
      } else if (url.includes("type=recovery") || url.includes("access_token=")) {
        setCloudModalMode("new_password");
        setCloudModalError(null);
        setShowCloudModal(true);
      } else if (url.includes("otp_expired") || url.includes("error_code=")) {
        setCloudModalMode("forgot");
        setCloudModalError(
          "This password reset link has expired or was already used. Please request a fresh one."
        );
        setShowCloudModal(true);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepUrl(url);
    });

    const urlSub = Linking.addEventListener("url", (e) => {
      handleDeepUrl(e.url);
    });

    // 3. Supabase Auth State Listener
    const { data: authSub } = supabase.auth.onAuthStateChange((event: any) => {
      if (event === "PASSWORD_RECOVERY") {
        setCloudModalMode("new_password");
        setCloudModalError(null);
        setShowCloudModal(true);
      } else if (event === "SIGNED_OUT") {
        loadTransactions().then((guestTxns) => {
          setTxns(guestTxns);
        });
      } else if (event === "SIGNED_IN") {
        loadTransactions().then((userTxns) => {
          setTxns(userTxns);
        });
      }
    });

    return () => {
      urlSub.remove();
      authSub.subscription.unsubscribe();
    };
  }, []);

  // Load transactions
  useEffect(() => {
    (async () => {
      const data = await loadTransactions();
      setTxns(data);
      setLoaded(true);
    })();
  }, []);

  // Save transactions
  useEffect(() => {
    if (!loaded) return;
    saveTransactions(txns);
  }, [txns, loaded]);

  // Current active date range based on mode & offset
  const currentRange = useMemo(() => {
    if (timeframeMode === "daily") {
      return getDayRange(periodOffset);
    }
    if (timeframeMode === "week") {
      return getWeekRange(periodOffset);
    }
    if (timeframeMode === "month") {
      return getMonthRange(periodOffset);
    }
    return null;
  }, [timeframeMode, periodOffset]);

  // Dynamic header badge label reflecting current view
  const headerBadgeLabel = useMemo(() => {
    if (timeframeMode === "history") {
      return "All · archive";
    }
    if (timeframeMode === "daily") {
      if (periodOffset === 0) return "Today · diary";
      if (periodOffset === -1) return "Yest · diary";
      const d = new Date();
      d.setDate(d.getDate() + periodOffset);
      const mLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `${mLabel} · diary`;
    }
    if (timeframeMode === "week") {
      const now = new Date();
      const currentDay = now.getDay();
      const distanceToMonday = (currentDay + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - distanceToMonday + periodOffset * 7);
      const mLabel = monday.toLocaleDateString("en-US", { month: "short" });
      return `${mLabel} · week`;
    }
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + periodOffset, 1);
    const mLabel = targetDate.toLocaleDateString("en-US", { month: "short" });
    return `${mLabel} · diary`;
  }, [timeframeMode, periodOffset]);

  // Filtered transactions for active timeframe & filters
  const scopedTxns = useMemo(() => {
    let list = txns;
    if (currentRange) {
      list = list.filter((t) => isDateInRange(t.date, currentRange));
    }
    if (selectedTag) {
      list = list.filter((t) => t.category === selectedTag);
    }
    if (selectedTypeFilter) {
      list = list.filter((t) => t.type === selectedTypeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.note.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.amount.toString().includes(q)
      );
    }
    return list;
  }, [txns, currentRange, selectedTag, selectedTypeFilter, searchQuery]);

  // Scoped totals for active timeframe
  const scopedTotals = useMemo(() => {
    let income = 0;
    let spent = 0;
    for (const t of scopedTxns) {
      if (t.type === "income") income += t.amount;
      else spent += t.amount;
    }
    const balance = income - spent;
    const maxBar = Math.max(income, spent, 1);
    return {
      income,
      spent,
      balance,
      incomePct: Math.min(100, Math.max(0, (income / maxBar) * 100)),
      spentPct: Math.min(100, Math.max(0, (spent / maxBar) * 100)),
    };
  }, [scopedTxns]);

  // Category counts and totals for tag navigation (within scoped transactions)
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; totalSpent: number }> = {};
    for (const c of CATEGORIES) {
      stats[c.key] = { count: 0, totalSpent: 0 };
    }
    for (const t of scopedTxns) {
      if (stats[t.category]) {
        stats[t.category].count += 1;
        if (t.type === "expense") {
          stats[t.category].totalSpent += t.amount;
        }
      }
    }
    return stats;
  }, [scopedTxns]);

  // Grouped transactions by day for list view
  const groupedDays = useMemo(() => {
    return groupTransactionsByDate(scopedTxns, sortOrder);
  }, [scopedTxns, sortOrder]);

  // Month archives for All History mode
  const monthArchives = useMemo(() => {
    return buildMonthArchives(txns);
  }, [txns]);

  // Clean dynamic badges for opening scene
  const openingBadges = useMemo(() => {
    if (txns.length >= 4) {
      return txns.slice(0, 4).map((t) => {
        const cat = CATEGORIES.find((c) => c.key === t.category) ?? CATEGORIES[0];
        return `${cat.emoji} ${cat.label.toLowerCase()} · ${currency.symbol}${fmt(t.amount)}`;
      });
    }
    return ["☕ coffee", "🛒 groceries", "🎬 fun", "💼 salary"];
  }, [txns, currency.symbol]);

  const balanceWhole = Math.floor(Math.abs(scopedTotals.balance));
  const balanceCents = String(
    Math.round((Math.abs(scopedTotals.balance) - balanceWhole) * 100)
  ).padStart(2, "0");

  // Timeframe Mode Switching
  const handleSelectMode = (mode: TimeframeMode) => {
    safeHaptic.selection();
    setTimeframeMode(mode);
    setPeriodOffset(0);
  };

  // Period Shift
  const handleShiftPeriod = (direction: -1 | 1) => {
    safeHaptic.selection();
    setPeriodOffset((prev) => prev + direction);
  };

  const handleJumpToCurrent = () => {
    safeHaptic.light();
    setPeriodOffset(0);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    safeHaptic.light();
    setEditingTxnId(null);
    setFormType(selectedTypeFilter ?? "expense");
    setFormAmount("");
    setAmountError(null);
    setFormCategory(selectedTag ?? "coffee");
    setFormNote("");
    setFormDate(getTodayISO());
    setModalVisible(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (t: Txn) => {
    safeHaptic.selection();
    setEditingTxnId(t.id);
    setFormType(t.type);
    setFormAmount(t.amount.toString());
    setAmountError(null);
    setFormCategory(t.category);
    setFormNote(t.note);
    setFormDate(t.date);
    setModalVisible(true);
  };

  // Drilldown from History Card into Month
  const handleDrilldownMonth = (year: number, month: number) => {
    safeHaptic.selection();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const offset = (year - currentYear) * 12 + (month - currentMonth);

    setTimeframeMode("month");
    setPeriodOffset(offset);
  };

  // Save or Update Entry
  const handleSaveTxn = async () => {
    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) {
      setAmountError(
        !formAmount.trim()
          ? "Please enter an amount."
          : `Please enter an amount greater than ${currency.symbol}0.`
      );
      safeHaptic.warning();
      return;
    }

    const selectedCat =
      CATEGORIES.find((c) => c.key === formCategory) ?? CATEGORIES[0];
    const finalNote = formNote.trim() || selectedCat.label;

    if (editingTxnId) {
      setTxns((prev) =>
        prev.map((t) =>
          t.id === editingTxnId
            ? {
                ...t,
                type: formType,
                amount: Math.round(amt * 100) / 100,
                category: formCategory,
                note: finalNote,
                date: formDate,
              }
            : t
        )
      );
      safeHaptic.success();
    } else {
      const newTxn: Txn = {
        id: uid(),
        type: formType,
        amount: Math.round(amt * 100) / 100,
        category: formCategory,
        note: finalNote,
        date: formDate,
      };
      setTxns((prev) => [newTxn, ...prev]);
      safeHaptic.success();
    }

    setModalVisible(false);
  };

  // Prompt Delete Transaction
  const handleDeletePrompt = (t: Txn) => {
    safeHaptic.warning();
    setDeleteConfirmTxn(t);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteConfirmTxn) return;
    safeHaptic.impact();
    const id = deleteConfirmTxn.id;
    setTxns((prev) => prev.filter((t) => t.id !== id));
    if (editingTxnId === id) {
      setModalVisible(false);
      setEditingTxnId(null);
    }
    setDeleteConfirmTxn(null);
    await deleteTransaction(id);
  };

  // Confirm Reset Journal
  const handleConfirmReset = async () => {
    safeHaptic.warning();
    setTxns([]);
    setSelectedTag(null);
    setSelectedTypeFilter(null);
    setShowResetConfirm(false);
    await clearTransactions();
  };

  // Hero Card Eyebrow Label
  const heroEyebrow = useMemo(() => {
    if (timeframeMode === "daily") {
      return periodOffset === 0 ? "TODAY'S BALANCE" : "DAILY BALANCE";
    }
    if (timeframeMode === "week") {
      return periodOffset === 0 ? "THIS WEEK'S BALANCE" : "WEEKLY BALANCE";
    }
    if (timeframeMode === "month") {
      return periodOffset === 0 ? "THIS MONTH'S BALANCE" : "MONTHLY BALANCE";
    }
    return "ALL-TIME NET SAVINGS";
  }, [timeframeMode, periodOffset]);

  // Scalable flattened feed items for Shopify's FlashList (cell recycling)
  const feedItems = useMemo<FeedItem[]>(() => {
    if (timeframeMode === "history") {
      return monthArchives.map((m) => ({
        type: "archive",
        id: `archive-${m.key}`,
        archive: m,
      }));
    }

    const items: FeedItem[] = [];
    for (const group of groupedDays) {
      items.push({
        type: "header",
        id: `header-${group.date}`,
        date: group.date,
        displayDate: group.displayDate,
        netFlow: group.netFlow,
      });
      for (const t of group.txns) {
        items.push({
          type: "txn",
          id: t.id,
          txn: t,
        });
      }
    }
    return items;
  }, [timeframeMode, monthArchives, groupedDays]);

  const renderFeedItem = ({ item }: { item: FeedItem }) => {
    if (item.type === "header") {
      const isNetIncome = item.netFlow >= 0;
      return (
        <View style={styles.dayGroupHeader}>
          <View style={styles.dayDatePill}>
            <Text style={styles.dayDateText}>{item.displayDate}</Text>
          </View>
          <Text
            style={[
              styles.daySubtotalText,
              { color: isNetIncome ? "#379E75" : "#E26543" },
            ]}
          >
            {isNetIncome ? `+${currency.symbol}` : `−${currency.symbol}`}
            {fmt(Math.abs(item.netFlow))}
          </Text>
        </View>
      );
    }

    if (item.type === "archive") {
      const m = item.archive;
      const isPositive = m.balance >= 0;
      return (
        <Pressable
          key={m.key}
          onPress={() => handleDrilldownMonth(m.year, m.month)}
          style={({ pressed }) => [
            styles.monthArchiveCard,
            STYLES.card,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
        >
          <View style={styles.archiveTopRow}>
            <View style={styles.archiveTitleGroup}>
              <Text style={styles.archiveMonthTitle}>{m.label}</Text>
              <Text style={styles.archiveCountText}>
                {m.count} {m.count === 1 ? "entry" : "entries"}
              </Text>
            </View>

            <View
              style={[
                styles.archiveSavingsBadge,
                { backgroundColor: isPositive ? "#D4F0E3" : "#FFE0D6" },
              ]}
            >
              <Text
                style={[
                  styles.archiveSavingsText,
                  { color: isPositive ? "#2D8C65" : "#D45233" },
                ]}
              >
                {isPositive ? `+${currency.symbol}` : `−${currency.symbol}`}
                {fmt(Math.abs(m.balance))}
              </Text>
            </View>
          </View>

          <View style={styles.archiveStatsRow}>
            <View style={styles.archiveStatItem}>
              <Text style={styles.archiveStatLabel}>Income</Text>
              <Text style={[styles.archiveStatVal, { color: "#379E75" }]}>
                +{currency.symbol}{fmt(m.income)}
              </Text>
            </View>
            <View style={styles.archiveStatItem}>
              <Text style={styles.archiveStatLabel}>Spent</Text>
              <Text style={[styles.archiveStatVal, { color: "#E26543" }]}>
                -{currency.symbol}{fmt(m.spent)}
              </Text>
            </View>
          </View>
        </Pressable>
      );
    }

    const t = item.txn;
    const cat = CATEGORIES.find((c) => c.key === t.category) ?? CATEGORIES[0];
    const col = getCategoryColor(cat.bg);
    const isIncome = t.type === "income";

    return (
      <Pressable
        key={t.id}
        onPress={() => handleOpenEdit(t)}
        style={({ pressed }) => [
          styles.txnCard,
          STYLES.card,
          pressed && {
            opacity: 0.85,
            transform: [{ scale: 0.98 }],
          },
        ]}
      >
        {/* Category Sticker Tag */}
        <Pressable
          hitSlop={8}
          onPress={() => {
            safeHaptic.selection();
            setSelectedTag(t.category === selectedTag ? null : t.category);
          }}
          style={[
            styles.txnIconBox,
            {
              backgroundColor: col.bg,
              transform: [{ rotate: cat.rotate as any }],
            },
          ]}
        >
          <Text style={styles.txnEmoji}>{cat.emoji}</Text>
        </Pressable>

        {/* Note and Category */}
        <View style={styles.txnInfo}>
          <View style={styles.noteRow}>
            <Text numberOfLines={1} style={styles.txnNote}>
              {t.note}
            </Text>
            <Edit2 size={12} color={COLORS.inkSoft} style={{ marginLeft: 4 }} />
          </View>
          <Text style={styles.txnMeta}>{cat.label}</Text>
        </View>

        {/* Amount and Delete Action */}
        <View style={styles.txnRight}>
          <Text
            style={[
              styles.txnAmount,
              { color: isIncome ? "#379E75" : "#E26543" },
            ]}
          >
            {isIncome ? "+" : "−"}{currency.symbol}{fmt(t.amount)}
          </Text>
          <Pressable
            hitSlop={12}
            onPress={(e) => {
              e.stopPropagation?.();
              handleDeletePrompt(t);
            }}
            style={styles.deleteButton}
          >
            <Trash2 size={14} color={COLORS.inkSoft} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const renderListHeader = () => (
    <View>
      {/* Dynamic Balance Hero Card */}
      <View style={[STYLES.card, isCompact && { padding: 14 }]}>
        <View style={styles.cardTopRow}>
          <Text style={[styles.cardEyebrow, isCompact && { fontSize: 10 }]}>{heroEyebrow}</Text>
          <View style={styles.sparkleBadge}>
            <Text style={styles.sparkleText}>sparkle ✿</Text>
          </View>
        </View>

        {/* Amount Display */}
        <View style={styles.balanceRow}>
          <Text style={[styles.currencySymbol, isCompact && { fontSize: 22 }]}>
            {scopedTotals.balance < 0 ? `−${currency.symbol}` : currency.symbol}
          </Text>
          <Text
            style={[
              styles.balanceBigText,
              isCompact && { fontSize: 36, lineHeight: 40 },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {balanceWhole.toLocaleString("en-US")}
          </Text>
          <Text style={[styles.balanceCentsText, isCompact && { fontSize: 20 }]}>.{balanceCents}</Text>
        </View>

        {/* Interactive Income / Spent Toggles */}
        <View style={[styles.progressSection, isCompact && { gap: 8, marginTop: 12 }]}>
          <Pressable
            onPress={() => {
              safeHaptic.selection();
              setSelectedTypeFilter((prev) => (prev === "income" ? null : "income"));
            }}
            style={[
              styles.progressItem,
              isCompact && { paddingHorizontal: 8, paddingVertical: 8 },
              selectedTypeFilter === "income" && styles.progressItemActive,
            ]}
          >
            <View style={styles.progressHeaderRow}>
              <View style={styles.typeTagRow}>
                <View style={[styles.typeIconBubble, { backgroundColor: "#E3F7EE" }]}>
                  <ArrowDownLeft size={10} color="#2D8C65" strokeWidth={2.5} />
                </View>
                <Text style={[styles.progressLabel, isCompact && { fontSize: 9.5 }]}>Income</Text>
              </View>
              {selectedTypeFilter === "income" && (
                <View style={styles.filterActivePill}>
                  <Text style={styles.filterActivePillText}>ACTIVE</Text>
                </View>
              )}
            </View>

            <Text
              style={[styles.progressValue, isCompact && { fontSize: 13 }, { color: "#2D8C65" }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              +{currency.symbol}{fmt(scopedTotals.income)}
            </Text>

            <View style={[styles.progressBarTrack, { backgroundColor: "#D4F0E3" }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${scopedTotals.incomePct}%`,
                    backgroundColor: COLORS.mint,
                  },
                ]}
              />
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              safeHaptic.selection();
              setSelectedTypeFilter((prev) => (prev === "expense" ? null : "expense"));
            }}
            style={[
              styles.progressItem,
              isCompact && { paddingHorizontal: 8, paddingVertical: 8 },
              selectedTypeFilter === "expense" && styles.progressItemActive,
            ]}
          >
            <View style={styles.progressHeaderRow}>
              <View style={styles.typeTagRow}>
                <View style={[styles.typeIconBubble, { backgroundColor: "#FFE0D6" }]}>
                  <ArrowUpRight size={10} color="#D35433" strokeWidth={2.5} />
                </View>
                <Text style={[styles.progressLabel, isCompact && { fontSize: 9.5 }]}>Spent</Text>
              </View>
              {selectedTypeFilter === "expense" && (
                <View style={styles.filterActivePill}>
                  <Text style={styles.filterActivePillText}>ACTIVE</Text>
                </View>
              )}
            </View>

            <Text
              style={[styles.progressValue, isCompact && { fontSize: 13 }, { color: "#D35433" }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              -{currency.symbol}{fmt(scopedTotals.spent)}
            </Text>

            <View style={[styles.progressBarTrack, { backgroundColor: "#FFE0D6" }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${scopedTotals.spentPct}%`,
                    backgroundColor: COLORS.peach,
                  },
                ]}
              />
            </View>
          </Pressable>
        </View>
      </View>

      {/* Category Tag Navigation Bar */}
      <View style={[styles.categoriesSection, { marginHorizontal: -horizontalPad }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.categoryScroll, { paddingHorizontal: horizontalPad }]}
        >
          {/* All Tag */}
          <Pressable
            onPress={() => {
              safeHaptic.selection();
              setSelectedTag(null);
            }}
            style={[
              STYLES.chip,
              {
                backgroundColor: selectedTag === null ? COLORS.ink : COLORS.cream,
                marginRight: 8,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: selectedTag === null ? COLORS.cream : COLORS.ink },
              ]}
            >
              🏷️ All ({scopedTxns.length})
            </Text>
          </Pressable>

          {/* Individual Tags */}
          {CATEGORIES.map((c) => {
            const active = selectedTag === c.key;
            const col = getCategoryColor(c.bg);
            const count = categoryStats[c.key]?.count || 0;

            return (
              <Pressable
                key={c.key}
                onPress={() => {
                  safeHaptic.selection();
                  setSelectedTag(active ? null : c.key);
                }}
                style={[
                  STYLES.chip,
                  {
                    backgroundColor: active ? col.bg : COLORS.cream,
                    borderColor: active ? COLORS.ink : COLORS.cardBorder,
                    marginRight: 8,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    active && col.bg === "peach" && { color: COLORS.cream },
                  ]}
                >
                  {c.emoji} {c.label} {count > 0 ? `(${count})` : ""}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Active Filter Banner */}
      {Boolean(selectedTag || selectedTypeFilter || searchQuery.trim().length > 0) ? (
        <View style={styles.activeFilterBanner}>
          <View style={styles.activeFilterContent}>
            <Filter size={13} color={COLORS.ink} />
            <Text style={styles.activeFilterText}>
              {selectedTag ? `Tag: ${selectedTag}  ` : null}
              {selectedTypeFilter ? `Type: ${selectedTypeFilter}  ` : null}
              {searchQuery.trim() ? `"${searchQuery}"  ` : null}
              {`• ${scopedTxns.length} entry${scopedTxns.length === 1 ? "" : "ies"}`}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              safeHaptic.selection();
              setSelectedTag(null);
              setSelectedTypeFilter(null);
              setSearchQuery("");
            }}
            style={styles.clearFilterChip}
          >
            <Text style={styles.clearFilterText}>Clear</Text>
            <X size={12} color={COLORS.ink} />
          </Pressable>
        </View>
      ) : null}

      {/* Section Header Row */}
      {timeframeMode === "history" ? (
        <View style={[styles.listHeaderRow, isCompact && { flexWrap: "wrap", rowGap: 6 }]}>
          <View style={styles.listHeaderLeft}>
            <Text style={styles.listHeaderTitle}>MONTHLY ARCHIVES</Text>
            <Text style={styles.arrowIcon}>↝</Text>
          </View>
          {!isCompact && <Text style={styles.tapHintText}>tap month to inspect</Text>}
        </View>
      ) : (
        <View style={[styles.listHeaderRow, isCompact && { flexWrap: "wrap", rowGap: 6 }]}>
          <View style={styles.listHeaderLeft}>
            <Text style={[styles.listHeaderTitle, isCompact && { fontSize: 10.5 }]}>
              {selectedTag
                ? `${selectedTag.toUpperCase()} ENTRIES`
                : "NOTEBOOK ENTRIES"}
            </Text>
            <Pressable
              onPress={() => {
                safeHaptic.selection();
                setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
              }}
              style={({ pressed }) => [
                styles.sortToggleBtn,
                isCompact && { paddingHorizontal: 6, paddingVertical: 2 },
                pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
              ]}
              hitSlop={6}
              accessibilityLabel={`Sort order: currently ${sortOrder === "desc" ? "Newest first" : "Oldest first"}. Tap to change.`}
            >
              <Text style={styles.sortToggleArrow}>
                {sortOrder === "desc" ? "↓" : "↑"}
              </Text>
              <Text style={[styles.sortToggleText, isCompact && { fontSize: 10 }]}>
                {sortOrder === "desc" ? "Newest" : "Oldest"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.listHeaderRight}>
            {!isCompact && <Text style={styles.tapHintText}>tap item to edit</Text>}
            {txns.length > 0 ? (
              <Pressable
                hitSlop={8}
                onPress={() => {
                  safeHaptic.warning();
                  setShowResetConfirm(true);
                }}
              >
                <Text style={styles.resetButtonText}>reset</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );

  const renderListEmpty = () => {
    if (timeframeMode === "history") return null;
    return (
      <View style={[STYLES.card, styles.emptyCard]}>
        <Text style={styles.emptyEmoji}>📒</Text>
        <Text style={styles.emptyTitle}>no entries in this period</Text>
        <Text style={styles.emptySubtitle}>
          {selectedTag || selectedTypeFilter || searchQuery
            ? "Try clearing filters or changing the period ✿"
            : "Tap \"+ Add Entry\" below to log something ✿"}
        </Text>
      </View>
    );
  };

  const renderListFooter = () => (
    <View style={styles.quoteCard}>
      <Text style={styles.quoteText}>
        "a steady little habit beats a big reset."
      </Text>
      <Text style={styles.quoteAuthor}>— the pocket ledger</Text>
    </View>
  );

  // -------------------------------------------------------------
  // OPENING SCENE / WELCOME SPLASH
  // -------------------------------------------------------------
  if (showOpeningScene) {
    return (
      <View style={[styles.openingContainer, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        {/* Top welcome sticker */}
        <Animated.View style={[styles.openingTopPill, { opacity: fadeAnim }]}>
          <Text style={styles.openingTopPillText}>✿ welcome to your little penny journal</Text>
        </Animated.View>

        {/* Center Hero Logo & Branding */}
        <View style={styles.openingCenterArea}>
          {/* Floating Sticker Badges */}
          <Animated.View
            style={[
              styles.openingBadgeSticker,
              styles.stickerTopLeft,
              {
                opacity: fadeAnim,
                transform: [{ translateY: floatAnim }, { rotate: "-8deg" }],
              },
            ]}
          >
            <Text style={styles.openingStickerText}>{openingBadges[0]}</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.openingBadgeSticker,
              styles.stickerTopRight,
              {
                opacity: fadeAnim,
                transform: [{ translateY: floatAnim }, { rotate: "6deg" }],
              },
            ]}
          >
            <Text style={styles.openingStickerText}>{openingBadges[1]}</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.openingBadgeSticker,
              styles.stickerBottomLeft,
              {
                opacity: fadeAnim,
                transform: [{ translateY: floatAnim }, { rotate: "-5deg" }],
              },
            ]}
          >
            <Text style={styles.openingStickerText}>{openingBadges[2]}</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.openingBadgeSticker,
              styles.stickerBottomRight,
              {
                opacity: fadeAnim,
                transform: [{ translateY: floatAnim }, { rotate: "7deg" }],
              },
            ]}
          >
            <Text style={styles.openingStickerText}>{openingBadges[3]}</Text>
          </Animated.View>

          {/* Center Brand Logo Icon */}
          <Animated.View
            style={[
              styles.openingLogoBox,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }, { rotate: "-8deg" }],
              },
            ]}
          >
            {/* Peeking Golden Penny Coin */}
            <View style={styles.openingPennyCoin}>
              <View style={styles.openingCoinInnerRing}>
                <Text style={styles.openingCoinSymbol}>
                  {currency.symbol.length > 2 ? currency.symbol[0] : currency.symbol}
                </Text>
              </View>
            </View>

            {/* Pocket Squircle Body */}
            <View style={styles.openingPocketBody}>
              {/* Pocket Stitch Lines */}
              <View style={styles.openingPocketTopStitch} />
              <View style={styles.openingPocketBottomStitch} />
              {/* Corner Brass Rivets */}
              <View style={[styles.openingRivet, { left: 8 }]} />
              <View style={[styles.openingRivet, { right: 8 }]} />
              {/* Bold Letter 'p' */}
              <Text style={styles.openingLogoLetter}>p</Text>
            </View>
          </Animated.View>

          {/* App Title */}
          <Animated.View style={[styles.openingTitleGroup, { opacity: fadeAnim }]}>
            <Text style={styles.openingMainTitle}>pocket.</Text>
            <Text style={styles.openingSubTitle}>penny journal</Text>
          </Animated.View>

          {/* Cozy Quote Note Card */}
          <Animated.View style={[styles.openingQuoteCard, { opacity: fadeAnim }]}>
            <Text style={styles.openingQuoteText}>
              "a cozy little place to track every peso, notice your daily habits, and watch your savings grow ✿"
            </Text>
          </Animated.View>
        </View>

        {/* Bottom Auto-Redirect Area */}
        <Animated.View style={[styles.openingBottomArea, { opacity: fadeAnim }]}>
          <View style={styles.openingProgressContainer}>
            <View style={styles.openingProgressTrack}>
              <Animated.View
                style={[
                  styles.openingProgressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>
            <View style={styles.openingLoadingRow}>
              <Text style={styles.openingLoadingText}>opening your notebook... ✿</Text>
            </View>
          </View>
          <Text style={styles.openingFooterNotice}>
            offline & private · saves directly on your device
          </Text>
        </Animated.View>
      </View>
    );
  }

  // -------------------------------------------------------------
  // MAIN APPLICATION SCREEN
  // -------------------------------------------------------------
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* App Header */}
      <View style={[styles.header, { paddingHorizontal: horizontalPad }]}>
        <Pressable
          onPress={() => {
            safeHaptic.light();
            setSelectedTag(null);
            setSelectedTypeFilter(null);
            setSearchQuery("");
            setShowSearch(false);
            (scrollRef.current as any)?.scrollToOffset
              ? (scrollRef.current as any).scrollToOffset({ offset: 0, animated: true })
              : scrollRef.current?.scrollTo?.({ y: 0, animated: true });
          }}
          style={styles.headerLeft}
          hitSlop={8}
        >
          <View style={[styles.brandIconWrapper, isCompact && { width: 38, height: 38 }]}>
            {/* Peeking Mini Penny Coin */}
            <View style={[styles.brandPennyCoin, isCompact && { width: 14, height: 14, top: 0, right: 2 }]}>
              <Text style={[styles.brandCoinSymbol, isCompact && { fontSize: 7, lineHeight: 8.5 }]}>
                {currency.symbol.length > 2 ? currency.symbol[0] : currency.symbol}
              </Text>
            </View>

            {/* Mini Pocket Squircle Body */}
            <View style={[styles.brandPocketBody, isCompact && { width: 32, height: 32, borderRadius: 11 }]}>
              <View style={[styles.brandPocketTopStitch, isCompact && { top: 5, left: 4, right: 4 }]} />
              <View style={[styles.brandRivet, { left: isCompact ? 3 : 4 }]} />
              <View style={[styles.brandRivet, { right: isCompact ? 3 : 4 }]} />
              <Text style={[styles.brandIconText, isCompact && { fontSize: 18 }]}>p</Text>
            </View>
          </View>
          <View>
            <Text style={[styles.brandTitle, isCompact && { fontSize: 18, lineHeight: 20 }]}>pocket.</Text>
            <Text style={styles.brandSubtitle}>penny journal</Text>
          </View>
        </Pressable>

        <View style={[styles.headerRight, isCompact && { gap: 6 }]}>
          <Pressable
            onPress={() => {
              safeHaptic.selection();
              setShowSettingsModal(true);
            }}
            style={[styles.headerIconButton, isCompact && { width: 30, height: 30, borderRadius: 10 }]}
            hitSlop={8}
            accessibilityLabel="Open Settings & About"
          >
            <Settings size={isCompact ? 14 : 15} color={COLORS.ink} strokeWidth={2.2} />
          </Pressable>

          <Pressable
            onPress={() => {
              safeHaptic.selection();
              setShowCloudModal(true);
            }}
            style={[styles.headerIconButton, isCompact && { width: 30, height: 30, borderRadius: 10 }]}
            hitSlop={8}
            accessibilityLabel="Open Cloud Sync & Backup"
          >
            <Cloud size={isCompact ? 14 : 15} color={COLORS.ink} strokeWidth={2.2} />
          </Pressable>

          <Pressable
            onPress={() => {
              safeHaptic.selection();
              setShowSearch((prev) => !prev);
            }}
            style={[
              styles.headerIconButton,
              isCompact && { width: 30, height: 30, borderRadius: 10 },
              showSearch && { backgroundColor: COLORS.ink, borderColor: COLORS.ink },
            ]}
          >
            <Search
              size={isCompact ? 14 : 15}
              color={showSearch ? COLORS.cream : COLORS.ink}
              strokeWidth={2.2}
            />
          </Pressable>

          {!isCompact && (
            <Pressable
              onPress={() => {
                safeHaptic.selection();
                if (timeframeMode === "daily") {
                  setTimeframeMode("week");
                  setPeriodOffset(0);
                } else if (timeframeMode === "week") {
                  setTimeframeMode("month");
                  setPeriodOffset(0);
                } else {
                  setTimeframeMode("daily");
                  setPeriodOffset(0);
                }
              }}
              style={({ pressed }) => [
                styles.headerBadge,
                pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
              ]}
              hitSlop={8}
            >
              <Text style={styles.headerBadgeText}>
                {headerBadgeLabel}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Expandable Search Input */}
      {showSearch && (
        <View style={[styles.searchBarContainer, { paddingHorizontal: horizontalPad }]}>
          <View style={styles.searchBarWrapper}>
            <Search size={16} color={COLORS.inkSoft} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by note, amount, category..."
              placeholderTextColor={COLORS.inkSoft}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 ? (
              <Pressable
                onPress={() => setSearchQuery("")}
                style={styles.searchClearBtn}
              >
                <X size={14} color={COLORS.ink} />
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      {/* Timeframe Mode Selector (Daily | Week | Month | All History) */}
      <View style={[styles.timeframeSegmentContainer, { paddingHorizontal: horizontalPad }]}>
        <View style={styles.timeframeSegment}>
          <Pressable
            onPress={() => handleSelectMode("daily")}
            style={[
              styles.timeframeBtn,
              timeframeMode === "daily" && styles.timeframeBtnActive,
            ]}
          >
            <Sun
              size={12}
              color={timeframeMode === "daily" ? COLORS.cream : COLORS.inkSoft}
            />
            <Text
              style={[
                styles.timeframeBtnText,
                isVeryCompact && { fontSize: 10.5 },
                timeframeMode === "daily" && styles.timeframeBtnTextActive,
              ]}
            >
              Daily
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleSelectMode("week")}
            style={[
              styles.timeframeBtn,
              timeframeMode === "week" && styles.timeframeBtnActive,
            ]}
          >
            <Clock
              size={12}
              color={timeframeMode === "week" ? COLORS.cream : COLORS.inkSoft}
            />
            <Text
              style={[
                styles.timeframeBtnText,
                isVeryCompact && { fontSize: 10.5 },
                timeframeMode === "week" && styles.timeframeBtnTextActive,
              ]}
            >
              Week
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleSelectMode("month")}
            style={[
              styles.timeframeBtn,
              timeframeMode === "month" && styles.timeframeBtnActive,
            ]}
          >
            <Calendar
              size={12}
              color={timeframeMode === "month" ? COLORS.cream : COLORS.inkSoft}
            />
            <Text
              style={[
                styles.timeframeBtnText,
                isVeryCompact && { fontSize: 10.5 },
                timeframeMode === "month" && styles.timeframeBtnTextActive,
              ]}
            >
              Month
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleSelectMode("history")}
            style={[
              styles.timeframeBtn,
              timeframeMode === "history" && styles.timeframeBtnActive,
            ]}
          >
            <Archive
              size={12}
              color={timeframeMode === "history" ? COLORS.cream : COLORS.inkSoft}
            />
            <Text
              style={[
                styles.timeframeBtnText,
                isVeryCompact && { fontSize: 10.5 },
                timeframeMode === "history" && styles.timeframeBtnTextActive,
              ]}
            >
              {isVeryCompact ? "All" : isCompact ? "History" : "All History"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Period Navigator Bar (Only for Week & Month) */}
      {currentRange && (
        <View style={[styles.periodNavigatorBar, { paddingHorizontal: horizontalPad }]}>
          <Pressable
            onPress={() => handleShiftPeriod(-1)}
            style={[styles.periodArrowBtn, isCompact && { width: 28, height: 28, borderRadius: 10 }]}
            hitSlop={8}
          >
            <ChevronLeft size={isCompact ? 16 : 18} color={COLORS.ink} />
          </Pressable>

          <View style={styles.periodCenterInfo}>
            <Text style={[styles.periodLabelText, isCompact && { fontSize: 13 }]}>{currentRange.label}</Text>
            {periodOffset !== 0 && (
              <Pressable
                onPress={handleJumpToCurrent}
                style={styles.jumpCurrentBadge}
              >
                <RotateCcw size={10} color={COLORS.peach} />
                <Text style={styles.jumpCurrentText}>Jump to current</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={() => handleShiftPeriod(1)}
            style={[styles.periodArrowBtn, isCompact && { width: 28, height: 28, borderRadius: 10 }]}
            hitSlop={8}
          >
            <ChevronRight size={isCompact ? 16 : 18} color={COLORS.ink} />
          </Pressable>
        </View>
      )}

      <FlashList
        ref={scrollRef}
        data={feedItems}
        renderItem={renderFeedItem}
        keyExtractor={(item) => item.id}
        getItemType={(item) => item.type}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, width: "100%" }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPad,
            paddingBottom: insets.bottom + 110,
            minHeight: "100%",
          },
        ]}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderListEmpty}
        ListFooterComponent={renderListFooter}
      />

      {/* Floating Add Entry Button */}
      <View style={[styles.fabContainer, { left: horizontalPad, right: horizontalPad, bottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={handleOpenCreate}
          style={[
            styles.fabButton,
            isCompact && { paddingVertical: 12, paddingHorizontal: 22 },
          ]}
        >
          <Plus size={isCompact ? 18 : 20} color={COLORS.cream} strokeWidth={2.5} />
          <Text style={[styles.fabButtonText, isCompact && { fontSize: 15 }]}>Add Entry</Text>
        </Pressable>
      </View>

      {/* Add / Edit Entry Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setModalVisible(false)}
          />

          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Text style={styles.modalTitle}>
                  {editingTxnId ? "Edit entry" : "New entry"}
                </Text>
                {editingTxnId ? (
                  <View style={styles.editingBadge}>
                    <Text style={styles.editingBadgeText}>editing</Text>
                  </View>
                ) : null}
              </View>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <X size={18} color={COLORS.ink} />
              </Pressable>
            </View>

            {/* Expense / Income Segmented Toggle */}
            <View style={styles.toggleContainer}>
              <Pressable
                onPress={() => {
                  safeHaptic.selection();
                  setFormType("expense");
                }}
                style={[
                  styles.toggleBtn,
                  formType === "expense" && styles.toggleBtnActiveExpense,
                ]}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    formType === "expense" && styles.toggleBtnTextActiveLight,
                  ]}
                >
                  Expense
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  safeHaptic.selection();
                  setFormType("income");
                }}
                style={[
                  styles.toggleBtn,
                  formType === "income" && styles.toggleBtnActiveIncome,
                ]}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    formType === "income" && styles.toggleBtnTextActiveDark,
                  ]}
                >
                  Income
                </Text>
              </Pressable>
            </View>

            {/* Amount Input */}
            <Text style={styles.fieldLabel}>Amount</Text>
            <View
              style={[
                styles.amountInputWrapper,
                Boolean(amountError) && styles.amountInputWrapperError,
              ]}
            >
              <Text
                style={[
                  styles.currencyPrefix,
                  Boolean(amountError) && { color: "#E53935" },
                ]}
              >
                {currency.symbol}
              </Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.inkSoft}
                value={formAmount}
                onChangeText={(val) => {
                  setFormAmount(val);
                  if (amountError) setAmountError(null);
                }}
                autoFocus={!editingTxnId}
              />
            </View>
            {Boolean(amountError) && (
              <View style={styles.amountErrorRow}>
                <CircleAlert size={13} color="#E53935" strokeWidth={2.2} />
                <Text style={styles.amountErrorText}>{amountError}</Text>
              </View>
            )}

            {/* Category Tag Selection */}
            <Text style={styles.fieldLabel}>Category Tag</Text>
            <View style={styles.categoryWrap}>
              {CATEGORIES.map((c) => {
                const active = formCategory === c.key;
                const col = getCategoryColor(c.bg);
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => {
                      safeHaptic.selection();
                      setFormCategory(c.key);
                    }}
                    style={[
                      styles.modalCategoryChip,
                      {
                        backgroundColor: active ? col.bg : COLORS.paper,
                        borderColor: COLORS.cardBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalCategoryChipText,
                        { color: active ? col.text : COLORS.ink },
                      ]}
                    >
                      {c.emoji} {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Note Input */}
            <Text style={styles.fieldLabel}>Note</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="what was it for? (e.g. flat white)"
              placeholderTextColor={COLORS.inkSoft}
              value={formNote}
              onChangeText={setFormNote}
            />

            {/* Quick Date Selection & Custom ISO input */}
            <View style={styles.datePickerRow}>
              <Text style={styles.fieldLabel}>Date: {formDate}</Text>
              <View style={styles.dateChipsRow}>
                <Pressable
                  onPress={() => {
                    safeHaptic.selection();
                    setFormDate(getTodayISO());
                  }}
                  style={[
                    styles.dateChip,
                    formDate === getTodayISO() && styles.dateChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      formDate === getTodayISO() && styles.dateChipTextActive,
                    ]}
                  >
                    Today
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    safeHaptic.selection();
                    setFormDate(getYesterdayISO());
                  }}
                  style={[
                    styles.dateChip,
                    formDate === getYesterdayISO() && styles.dateChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      formDate === getYesterdayISO() && styles.dateChipTextActive,
                    ]}
                  >
                    Yesterday
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Primary Action Button */}
            <Pressable onPress={handleSaveTxn} style={styles.submitButton}>
              <Check size={18} color={COLORS.cream} strokeWidth={2.5} />
              <Text style={styles.submitButtonText}>
                {editingTxnId ? "Save changes" : "Add to notebook"}
              </Text>
            </Pressable>

            {/* Delete button when editing */}
            {editingTxnId ? (
              <Pressable
                onPress={() => {
                  const t = txns.find((x) => x.id === editingTxnId);
                  if (t) handleDeletePrompt(t);
                }}
                style={styles.modalDeleteButton}
              >
                <Trash2 size={15} color="#E26543" />
                <Text style={styles.modalDeleteButtonText}>Delete this entry</Text>
              </Pressable>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* In-App Delete Confirmation Modal (Cross-Platform) */}
      <Modal
        visible={deleteConfirmTxn !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteConfirmTxn(null)}
      >
        <View style={styles.confirmModalOverlay}>
          <Pressable
            style={styles.confirmBackdrop}
            onPress={() => setDeleteConfirmTxn(null)}
          />
          <View style={styles.confirmDialogBox}>
            <View style={styles.confirmIconBubble}>
              <Trash2 size={24} color="#E26543" strokeWidth={2.2} />
            </View>
            <Text style={styles.confirmTitle}>Remove this entry?</Text>
            {deleteConfirmTxn ? (
              <Text style={styles.confirmSubtitle}>
                "{deleteConfirmTxn.note}" · {deleteConfirmTxn.type === "income" ? "+" : "−"}{currency.symbol}{fmt(deleteConfirmTxn.amount)}
              </Text>
            ) : null}
            <View style={styles.confirmButtonsRow}>
              <Pressable
                onPress={() => setDeleteConfirmTxn(null)}
                style={styles.confirmCancelBtn}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmDelete}
                style={styles.confirmDeleteBtn}
              >
                <Text style={styles.confirmDeleteText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* In-App Reset Confirmation Modal */}
      <Modal
        visible={showResetConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResetConfirm(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <Pressable
            style={styles.confirmBackdrop}
            onPress={() => setShowResetConfirm(false)}
          />
          <View style={styles.confirmDialogBox}>
            <View style={[styles.confirmIconBubble, { backgroundColor: "#FFE0D6" }]}>
              <RotateCcw size={24} color="#E26543" strokeWidth={2.2} />
            </View>
            <Text style={styles.confirmTitle}>Reset Penny Journal?</Text>
            <Text style={styles.confirmSubtitle}>
              This will clear all entries from storage. This action cannot be undone.
            </Text>
            <View style={styles.confirmButtonsRow}>
              <Pressable
                onPress={() => setShowResetConfirm(false)}
                style={styles.confirmCancelBtn}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmReset}
                style={styles.confirmDeleteBtn}
              >
                <Text style={styles.confirmDeleteText}>Clear All</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cloud Sync & Backup Modal */}
      <CloudSyncModal
        visible={showCloudModal}
        initialMode={cloudModalMode}
        initialError={cloudModalError}
        onClose={() => {
          setShowCloudModal(false);
          setCloudModalError(null);
          setCloudModalMode("signin");
        }}
        onSyncComplete={async () => {
          const updated = await loadTransactions();
          setTxns(updated);
        }}
        onSignOut={async () => {
          const guestTxns = await loadTransactions();
          setTxns(guestTxns);
        }}
      />

      {/* In-App Auto-Update Modal (Zero Data Loss) */}
      <UpdateModal
        visible={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
      />

      {/* Settings & About Modal */}
      <SettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        currency={currency}
        onSelectCurrency={handleSelectCurrency}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    backgroundColor: COLORS.paper,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandIconWrapper: {
    width: 44,
    height: 44,
    justifyContent: "flex-end",
    alignItems: "center",
    position: "relative",
    transform: [{ rotate: "-8deg" }],
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 2, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  brandPennyCoin: {
    position: "absolute",
    top: 1,
    right: 4,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: "#FFD166",
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 0,
  },
  brandCoinSymbol: {
    fontFamily: FONTS.displayBold,
    fontSize: 8.5,
    color: "#7A4F01",
    lineHeight: 10,
  },
  brandPocketBody: {
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
  brandPocketTopStitch: {
    position: "absolute",
    top: 7,
    left: 6,
    right: 6,
    borderTopWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(255, 255, 255, 0.75)",
  },
  brandRivet: {
    position: "absolute",
    top: 5.5,
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: "#FFD166",
    borderWidth: 0.8,
    borderColor: COLORS.cardBorder,
  },
  brandIconText: {
    fontFamily: FONTS.displayBold,
    fontSize: 22,
    color: COLORS.cream,
    marginTop: 1,
  },
  brandTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 20,
    color: COLORS.ink,
    lineHeight: 22,
  },
  brandSubtitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    color: COLORS.inkSoft,
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: COLORS.cream,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  headerBadge: {
    backgroundColor: COLORS.cream,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerBadgeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.ink,
  },
  searchBarContainer: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  searchBarWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cream,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.ink,
  },
  searchClearBtn: {
    padding: 4,
  },
  timeframeSegmentContainer: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  timeframeSegment: {
    flexDirection: "row",
    backgroundColor: COLORS.cream,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    borderRadius: 9999,
    padding: 3,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 1, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  timeframeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    borderRadius: 9999,
  },
  timeframeBtnActive: {
    backgroundColor: COLORS.ink,
  },
  timeframeBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11.5,
    color: COLORS.inkSoft,
  },
  timeframeBtnTextActive: {
    color: COLORS.cream,
  },
  periodNavigatorBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 6,
    marginBottom: 4,
  },
  periodArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: COLORS.cream,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 1, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  periodCenterInfo: {
    alignItems: "center",
  },
  periodLabelText: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: COLORS.ink,
  },
  jumpCurrentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  jumpCurrentText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.peach,
    textDecorationLine: "underline",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardEyebrow: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLORS.inkSoft,
  },
  sparkleBadge: {
    backgroundColor: "#FCE7BD",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    transform: [{ rotate: "-3deg" }],
  },
  sparkleText: {
    fontFamily: FONTS.display,
    fontSize: 12,
    color: COLORS.ink,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 10,
  },
  currencySymbol: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.ink,
    marginRight: 2,
  },
  balanceBigText: {
    fontFamily: FONTS.displayBold,
    fontSize: 48,
    color: COLORS.ink,
    lineHeight: 54,
  },
  balanceCentsText: {
    fontFamily: FONTS.display,
    fontSize: 26,
    color: COLORS.ink,
  },
  progressSection: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  progressItem: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.paper,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  progressItemActive: {
    borderColor: COLORS.ink,
    backgroundColor: COLORS.cream,
  },
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  typeTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  typeIconBubble: {
    width: 17,
    height: 17,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  progressLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10.5,
    color: COLORS.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filterActivePill: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  filterActivePillText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 8,
    color: COLORS.cream,
    letterSpacing: 0.5,
  },
  progressValue: {
    fontFamily: FONTS.displayBold,
    fontSize: 14.5,
    marginVertical: 4,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 9999,
    overflow: "hidden",
    marginTop: 2,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 9999,
  },
  categoriesSection: {
    marginVertical: 14,
  },
  categoryScroll: {
  },
  chipText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.ink,
  },
  activeFilterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F2E8D5",
    borderWidth: 1,
    borderColor: COLORS.inkSoft,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  activeFilterContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  activeFilterText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.ink,
  },
  clearFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: COLORS.cream,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  clearFilterText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.ink,
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  listHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sortToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.cream,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    shadowColor: COLORS.ink,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 0,
    elevation: 1,
  },
  sortToggleArrow: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.ink,
    lineHeight: 13,
  },
  sortToggleText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10.5,
    color: COLORS.ink,
    letterSpacing: 0.2,
  },
  listHeaderTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLORS.inkSoft,
  },
  arrowIcon: {
    fontSize: 16,
    color: COLORS.inkSoft,
  },
  listHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tapHintText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.inkSoft,
  },
  resetButtonText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.inkSoft,
    textDecorationLine: "underline",
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 36,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 18,
    color: COLORS.ink,
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.inkSoft,
    marginTop: 4,
  },
  dayGroupContainer: {
    marginBottom: 16,
  },
  dayGroupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  dayDatePill: {
    backgroundColor: COLORS.inkMuted,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dayDateText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.ink,
  },
  daySubtotalText: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
  },
  txnCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    marginBottom: 8,
  },
  txnIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  txnEmoji: {
    fontSize: 18,
  },
  txnInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  txnNote: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.ink,
    flexShrink: 1,
  },
  txnMeta: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.inkSoft,
    marginTop: 2,
  },
  txnRight: {
    alignItems: "flex-end",
  },
  txnAmount: {
    fontFamily: FONTS.displayBold,
    fontSize: 16,
  },
  deleteButton: {
    marginTop: 4,
    padding: 4,
  },
  historyArchiveSection: {
    marginBottom: 20,
  },
  monthArchiveCard: {
    padding: 16,
    marginBottom: 12,
  },
  archiveTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  archiveTitleGroup: {
    flex: 1,
  },
  archiveMonthTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 17,
    color: COLORS.ink,
  },
  archiveCountText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.inkSoft,
    marginTop: 2,
  },
  archiveSavingsBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  archiveSavingsText: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
  },
  archiveStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.inkMuted,
  },
  archiveStatItem: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  archiveStatLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.inkSoft,
  },
  archiveStatVal: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
  },
  quoteCard: {
    backgroundColor: "#DFD7F2",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    padding: 16,
    marginTop: 12,
    transform: [{ rotate: "-1deg" }],
  },
  quoteText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.ink,
  },
  quoteAuthor: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.inkSoft,
    marginTop: 4,
  },
  fabContainer: {
    position: "absolute",
    left: 20,
    right: 20,
    alignItems: "center",
  },
  fabButton: {
    backgroundColor: COLORS.peach,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 26,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 3, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  fabButtonText: {
    fontFamily: FONTS.displayBold,
    fontSize: 17,
    color: COLORS.cream,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(59, 51, 48, 0.4)",
  },
  modalSheet: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 22,
    color: COLORS.ink,
  },
  editingBadge: {
    backgroundColor: "#FCE7BD",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  editingBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.ink,
  },
  modalCloseButton: {
    padding: 6,
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.paper,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 3,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9999,
    alignItems: "center",
  },
  toggleBtnActiveExpense: {
    backgroundColor: COLORS.peach,
  },
  toggleBtnActiveIncome: {
    backgroundColor: COLORS.mint,
  },
  toggleBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.inkSoft,
  },
  toggleBtnTextActiveLight: {
    color: COLORS.cream,
  },
  toggleBtnTextActiveDark: {
    color: COLORS.ink,
  },
  fieldLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.inkSoft,
    marginBottom: 6,
  },
  amountInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.paper,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
  },
  amountInputWrapperError: {
    borderColor: "#E53935",
    backgroundColor: "#FFF5F5",
  },
  amountErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: -10,
    marginBottom: 14,
    marginLeft: 4,
  },
  amountErrorText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11.5,
    color: "#E53935",
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
  },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  modalCategoryChip: {
    borderWidth: 1.5,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  modalCategoryChipText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
  },
  noteInput: {
    backgroundColor: COLORS.paper,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.ink,
    marginBottom: 16,
  },
  datePickerRow: {
    marginBottom: 20,
  },
  dateChipsRow: {
    flexDirection: "row",
    gap: 8,
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: COLORS.paper,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  dateChipActive: {
    backgroundColor: COLORS.ink,
  },
  dateChipText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.ink,
  },
  dateChipTextActive: {
    color: COLORS.cream,
  },
  submitButton: {
    backgroundColor: COLORS.peach,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 2, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  submitButtonText: {
    fontFamily: FONTS.displayBold,
    fontSize: 17,
    color: COLORS.cream,
  },
  modalDeleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
  },
  modalDeleteButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: "#E26543",
  },
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(59, 51, 48, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  confirmDialogBox: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: COLORS.cream,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    padding: 22,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 3, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  confirmIconBubble: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#FFE0D6",
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  confirmTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 20,
    color: COLORS.ink,
    textAlign: "center",
  },
  confirmSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.inkSoft,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  confirmButtonsRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 9999,
    backgroundColor: COLORS.paper,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
  },
  confirmCancelText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.ink,
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 9999,
    backgroundColor: "#E26543",
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 1, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  confirmDeleteText: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: COLORS.cream,
  },
  // Opening Scene Styles
  openingContainer: {
    flex: 1,
    backgroundColor: COLORS.paper,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    alignItems: "center",
  },
  openingTopPill: {
    backgroundColor: COLORS.cream,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 1, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  openingTopPillText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.ink,
  },
  openingCenterArea: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    paddingVertical: 20,
  },
  openingLogoBox: {
    width: 106,
    height: 106,
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 16,
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 4, height: 5 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  openingPennyCoin: {
    position: "absolute",
    top: 2,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFD166",
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 0,
  },
  openingCoinInnerRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(122, 79, 1, 0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  openingCoinSymbol: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: "#7A4F01",
  },
  openingPocketBody: {
    width: 96,
    height: 96,
    borderRadius: 30,
    backgroundColor: COLORS.peach,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    zIndex: 1,
  },
  openingPocketTopStitch: {
    position: "absolute",
    top: 16,
    left: 14,
    right: 14,
    borderTopWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255, 255, 255, 0.75)",
  },
  openingPocketBottomStitch: {
    position: "absolute",
    bottom: 8,
    left: 14,
    right: 14,
    height: 22,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderStyle: "dashed",
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  openingRivet: {
    position: "absolute",
    top: 13,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFD166",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  openingLogoLetter: {
    fontFamily: FONTS.displayBold,
    fontSize: 52,
    color: COLORS.cream,
    marginTop: 2,
  },
  openingTitleGroup: {
    alignItems: "center",
    marginBottom: 20,
  },
  openingMainTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 50,
    color: COLORS.ink,
    lineHeight: 54,
    letterSpacing: -1,
  },
  openingSubTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.inkSoft,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 2,
  },
  openingQuoteCard: {
    backgroundColor: COLORS.cream,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 20,
    paddingVertical: 14,
    maxWidth: 320,
    transform: [{ rotate: "-1deg" }],
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 3, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  openingQuoteText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.ink,
    textAlign: "center",
    lineHeight: 19,
  },
  openingBadgeSticker: {
    position: "absolute",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  openingStickerText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.ink,
  },
  stickerTopLeft: {
    top: -10,
    left: 8,
    backgroundColor: COLORS.mint,
  },
  stickerTopRight: {
    top: 6,
    right: 6,
    backgroundColor: COLORS.lavender,
  },
  stickerBottomLeft: {
    bottom: -15,
    left: 10,
    backgroundColor: COLORS.peach,
  },
  stickerBottomRight: {
    bottom: -10,
    right: 8,
    backgroundColor: COLORS.butter,
  },
  openingBottomArea: {
    width: "100%",
    alignItems: "center",
    maxWidth: 340,
  },
  openingProgressContainer: {
    width: "100%",
    backgroundColor: COLORS.cream,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 2, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  openingProgressTrack: {
    height: 8,
    borderRadius: 9999,
    backgroundColor: COLORS.inkMuted,
    overflow: "hidden",
    marginBottom: 8,
  },
  openingProgressFill: {
    height: "100%",
    borderRadius: 9999,
    backgroundColor: COLORS.peach,
  },
  openingLoadingRow: {
    alignItems: "center",
    justifyContent: "center",
  },
  openingLoadingText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.ink,
    textAlign: "center",
  },
  openingFooterNotice: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.inkSoft,
    textAlign: "center",
  },
});


