// Pocket Penny Journal - High Scalability FlashList Architecture
import {
  Archive,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Cloud,
  Coins,
  Edit2,
  Filter,
  PieChart,
  PiggyBank,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Smile,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
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
import Constants from "expo-constants";
import { extractAuthParams } from "../services/authUtils";
import { COLORS, FONTS, STYLES } from "../constants/theme";
import { NeoCard } from "../components/NeoCard";
import { PocketBrandIcon } from "../components/PocketBrandIcon";
import { InsightsDonutChart, getCategorySliceColor } from "../components/InsightsDonutChart";
import Svg, { Line, Path } from "react-native-svg";
import { CloudSyncModal } from "../components/CloudSyncModal";
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
import {
  convertAmount,
  getCachedRates,
  loadConversionEnabled,
  refreshExchangeRates,
  saveConversionEnabled,
} from "../services/exchangeService";
import { safeHaptic } from "../services/haptics";
import {
  clearTransactions,
  deleteTransaction,
  loadSavedCurrency,
  loadTransactions,
  saveSavedCurrency,
  saveTransactions,
} from "../services/storage";
import { CURRENCIES, CurrencyOption, DEFAULT_CURRENCY } from "../constants/currencies";
import {
  ALL_CATEGORIES,
  CATEGORIES,
  Category,
  CategoryKey,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
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

function getCurrencySymbol(code: string): string {
  const found = CURRENCIES.find((c) => c.code === code);
  return found ? found.symbol : code;
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

function formatShortDate(dateStr: string): string {
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  } catch {}
  return dateStr;
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
  const horizontalPad = isVeryCompact ? 16 : isCompact ? 22 : 28;

  const [txns, setTxns] = useState<Txn[]>([]);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<any>(null);

  // Bottom Navigation Tab State
  const [activeBottomTab, setActiveBottomTab] = useState<"journal" | "insights" | "piggy" | "me">("journal");

  // Timeframe & Period Navigation
  const [timeframeMode, setTimeframeMode] = useState<TimeframeMode>("daily");
  const [periodOffset, setPeriodOffset] = useState<number>(0);
  const swipeCardAnim = useRef(new Animated.Value(0)).current; // -1: slide left, 0: center, 1: slide right

  // Filters
  const [selectedTag, setSelectedTag] = useState<CategoryKey | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<TxnType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Insights Tab State
  const [selectedInsightCategory, setSelectedInsightCategory] = useState<string | null>(null);
  const [expandedInsightCategory, setExpandedInsightCategory] = useState<string | null>(null);

  // Modal State (Create / Edit)
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTxnId, setEditingTxnId] = useState<string | null>(null);
  const [formType, setFormType] = useState<TxnType>("expense");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState<CategoryKey>("food_beverage");
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
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [cloudModalMode, setCloudModalMode] = useState<
    "signin" | "signup" | "forgot" | "new_password"
  >("signin");
  const [cloudModalError, setCloudModalError] = useState<string | null>(null);

  // In-App OTA Auto-Update State (Zero Data Loss)
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const currentVersion = Constants.expoConfig?.version ?? "1.0.0";

  // Me Tab Sub-Page Navigation State
  const [meSubPage, setMeSubPage] = useState<"main" | "updates" | "about" | "currency">("main");
  const [currencySearch, setCurrencySearch] = useState("");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<{
    type: "success" | "info" | "error";
    message: string;
  } | null>(null);

  // Currency Preference (Defaults to PHP, persists to local storage)
  const [currency, setCurrency] = useState<CurrencyOption>(DEFAULT_CURRENCY);
  const [liveConversionEnabled, setLiveConversionEnabled] = useState<boolean>(true);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

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

  const handleManualCheckUpdate = async () => {
    safeHaptic.selection();
    setCheckingUpdate(true);
    setUpdateNotice(null);

    try {
      const res = await checkForAppUpdate();
      setCheckingUpdate(false);

      if (res && res.isAvailable) {
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

  useEffect(() => {
    loadSavedCurrency().then((saved) => {
      if (saved) setCurrency(saved);
    });
    loadConversionEnabled().then((enabled) => {
      setLiveConversionEnabled(enabled);
    });
    getCachedRates().then((rates) => {
      setExchangeRates(rates);
    });
    refreshExchangeRates().then((rates) => {
      if (rates) setExchangeRates(rates);
    });
  }, []);

  const handleSelectCurrency = (newCurrency: CurrencyOption) => {
    setCurrency(newCurrency);
    saveSavedCurrency(newCurrency);
  };

  const handleToggleLiveConversion = (enabled: boolean) => {
    setLiveConversionEnabled(enabled);
    saveConversionEnabled(enabled);
  };

  // Check for updates silently in the background on startup
  useEffect(() => {
    checkForAppUpdate()
      .then((res) => {
        if (res && res.isAvailable) {
          setShowUpdateModal(true);
        }
      })
      .catch((err) => {
        console.warn("[Index] Silent update check error:", err);
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
        const isRecovery = fullUrl.includes("type=recovery");

        if (accessToken && refreshToken) {
          supabase.auth
            .setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            .then(() => {
              if (isRecovery) {
                setCloudModalMode("new_password");
                setCloudModalError(null);
                setShowCloudModal(true);
              } else {
                setShowCloudModal(false);
              }
            })
            .catch(() => {
              if (isRecovery) {
                setCloudModalMode("new_password");
                setCloudModalError(null);
                setShowCloudModal(true);
              }
            });
        } else if (code) {
          supabase.auth
            .exchangeCodeForSession(code)
            .then(() => {
              if (isRecovery) {
                setCloudModalMode("new_password");
                setCloudModalError(null);
                setShowCloudModal(true);
              } else {
                setShowCloudModal(false);
              }
            })
            .catch(() => {
              if (isRecovery) {
                setCloudModalMode("new_password");
                setCloudModalError(null);
                setShowCloudModal(true);
              }
            });
        } else if (isRecovery) {
          setCloudModalMode("new_password");
          setCloudModalError(null);
          setShowCloudModal(true);
        }
      }
    }

    // 2. Mobile deep link check (APK: pocket://reset-password#access_token=... or pocket://auth-callback)
    const handleDeepUrl = (url: string) => {
      const { accessToken, refreshToken, code, tokenHash, type, errorDescription } =
        extractAuthParams(url);
      const isRecovery = type === "recovery" || url.includes("type=recovery");

      if (accessToken && refreshToken) {
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(() => {
            if (isRecovery) {
              setCloudModalMode("new_password");
              setCloudModalError(null);
              setShowCloudModal(true);
            } else {
              setShowCloudModal(false);
            }
          });
      } else if (code) {
        supabase.auth.exchangeCodeForSession(code).then(() => {
          if (isRecovery) {
            setCloudModalMode("new_password");
            setCloudModalError(null);
            setShowCloudModal(true);
          } else {
            setShowCloudModal(false);
          }
        });
      } else if (tokenHash && type) {
        supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any }).then(() => {
          if (isRecovery) {
            setCloudModalMode("new_password");
            setCloudModalError(null);
            setShowCloudModal(true);
          } else {
            setShowCloudModal(false);
          }
        });
      } else if (isRecovery) {
        setCloudModalMode("new_password");
        setCloudModalError(null);
        setShowCloudModal(true);
      } else if (url.includes("otp_expired") || url.includes("error_code=") || Boolean(errorDescription)) {
        setCloudModalMode("forgot");
        setCloudModalError(
          errorDescription ||
            "This password reset or confirmation link has expired. Please request a fresh one."
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

  // Split period label (e.g. "Today (Sun, Sep 20)" -> main: "Today", sub: "(Sun, Sep 20)")
  const periodLabelParts = useMemo(() => {
    if (!currentRange) return { main: "", sub: "" };
    const match = currentRange.label.match(/^(.*?)\s*(\(.*?\))$/);
    if (match) {
      return { main: match[1], sub: match[2] };
    }
    return { main: currentRange.label, sub: "" };
  }, [currentRange]);

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

  // Transactions with live currency conversion applied (if enabled)
  const displayTxns = useMemo<Txn[]>(() => {
    if (!liveConversionEnabled) {
      return txns.map((t) => ({
        ...t,
        rawAmount: t.amount,
        rawCurrency: t.originalCurrency || DEFAULT_CURRENCY.code,
      }));
    }
    return txns.map((t) => {
      const origCode = t.originalCurrency || DEFAULT_CURRENCY.code;
      if (origCode === currency.code) {
        return {
          ...t,
          rawAmount: t.amount,
          rawCurrency: origCode,
        };
      }
      const converted = convertAmount(t.amount, origCode, currency.code, exchangeRates);
      return {
        ...t,
        amount: converted,
        rawAmount: t.amount,
        rawCurrency: origCode,
      };
    });
  }, [txns, liveConversionEnabled, currency.code, exchangeRates]);

  // Filtered transactions for active timeframe & filters
  const scopedTxns = useMemo(() => {
    let list = displayTxns;
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
          t.amount.toString().includes(q) ||
          (t.rawAmount !== undefined && t.rawAmount.toString().includes(q))
      );
    }
    return list;
  }, [displayTxns, currentRange, selectedTag, selectedTypeFilter, searchQuery]);

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
    return buildMonthArchives(displayTxns);
  }, [displayTxns]);

  // Clean dynamic badges for opening scene
  const openingBadges = useMemo(() => {
    if (displayTxns.length >= 4) {
      return displayTxns.slice(0, 4).map((t) => {
        const cat = ALL_CATEGORIES.find((c) => c.key === t.category) ?? CATEGORIES[0];
        return `${cat.emoji} ${cat.label.toLowerCase()} · ${currency.symbol}${fmt(t.amount)}`;
      });
    }
    return ["🍽️ food & drinks", "🛒 groceries", "🎬 fun", "💼 salary"];
  }, [displayTxns, currency.symbol]);

  const balanceWhole = Math.floor(Math.abs(scopedTotals.balance));
  const balanceCents = String(
    Math.round((Math.abs(scopedTotals.balance) - balanceWhole) * 100)
  ).padStart(2, "0");

  const MODES_LIST: TimeframeMode[] = ["daily", "week", "month", "history"];
  const timeframeModeRef = useRef<TimeframeMode>("month");
  timeframeModeRef.current = timeframeMode;

  // Timeframe Mode Switching with smooth horizontal slide
  const handleSelectMode = (mode: TimeframeMode, direction: -1 | 1 = 1) => {
    safeHaptic.selection();
    // Slide card out in the direction of swipe, then swap and slide back in
    Animated.timing(swipeCardAnim, {
      toValue: direction === 1 ? -36 : 36,
      duration: 90,
      useNativeDriver: true,
    }).start(() => {
      setTimeframeMode(mode);
      timeframeModeRef.current = mode;
      setPeriodOffset(0);
      swipeCardAnim.setValue(direction === 1 ? 36 : -36);
      Animated.spring(swipeCardAnim, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleStepHorizon = (step: -1 | 1) => {
    const current = timeframeModeRef.current;
    const idx = MODES_LIST.indexOf(current);
    const targetIdx = idx + step;
    if (targetIdx >= 0 && targetIdx < MODES_LIST.length) {
      handleSelectMode(MODES_LIST[targetIdx], step);
    }
  };

  // Horizontal Swipeable Time Horizon (Daily ⇄ Week ⇄ Month ⇄ History)
  const swipePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 18 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5
        );
      },
      onPanResponderMove: (_, gestureState) => {
        // Provide live dragging visual feedback with resistance
        const damped = Math.sign(gestureState.dx) * Math.min(Math.abs(gestureState.dx) * 0.35, 50);
        swipeCardAnim.setValue(damped);
      },
      onPanResponderRelease: (_, gestureState) => {
        const current = timeframeModeRef.current;
        const idx = MODES_LIST.indexOf(current);

        // Slide Right-to-Left (dx < -30): Go to NEXT horizon (Daily -> Week -> Month -> History)
        if (gestureState.dx < -30) {
          if (idx < MODES_LIST.length - 1) {
            handleSelectMode(MODES_LIST[idx + 1], 1);
            return;
          }
        }
        // Slide Left-to-Right (dx > 30): Go to PREVIOUS / BACK horizon (History -> Month -> Week -> Daily)
        else if (gestureState.dx > 30) {
          if (idx > 0) {
            handleSelectMode(MODES_LIST[idx - 1], -1);
            return;
          }
        }

        // Snap back if distance was too small or already at the boundary
        Animated.spring(swipeCardAnim, {
          toValue: 0,
          friction: 7,
          tension: 60,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

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
    const initType = selectedTypeFilter ?? "expense";
    setEditingTxnId(null);
    setFormType(initType);
    setFormAmount("");
    setAmountError(null);
    if (selectedTag) {
      const match = (initType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).find(
        (c) => c.key === selectedTag
      );
      setFormCategory(match ? selectedTag : initType === "income" ? "salary" : "food_beverage");
    } else {
      setFormCategory(initType === "income" ? "salary" : "food_beverage");
    }
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
    timeframeModeRef.current = "month";
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
      ALL_CATEGORIES.find((c) => c.key === formCategory) ?? CATEGORIES[0];
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
                originalCurrency: currency.code,
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
        originalCurrency: currency.code,
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
    if (resetConfirmText.trim().toLowerCase() !== "confirm") return;
    safeHaptic.warning();
    setTxns([]);
    setSelectedTag(null);
    setSelectedTypeFilter(null);
    setShowResetConfirm(false);
    setResetConfirmText("");
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
        <NeoCard
          key={m.key}
          onPress={() => handleDrilldownMonth(m.year, m.month)}
          shadowOffsetX={2}
          shadowOffsetY={2.5}
          borderRadius={20}
          style={styles.monthArchiveCard}
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
        </NeoCard>
      );
    }

    const t = item.txn;
    const cat = ALL_CATEGORIES.find((c) => c.key === t.category) ?? CATEGORIES[0];
    const col = getCategoryColor(cat.bg);
    const isIncome = t.type === "income";

    return (
      <NeoCard
        key={t.id}
        onPress={() => handleOpenEdit(t)}
        shadowOffsetX={2}
        shadowOffsetY={2}
        borderRadius={18}
        style={styles.txnCard}
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
          {liveConversionEnabled &&
            t.rawCurrency &&
            t.rawCurrency !== currency.code &&
            t.rawAmount !== undefined && (
              <Text style={styles.txnOrigAmount}>
                orig. {getCurrencySymbol(t.rawCurrency)}{fmt(t.rawAmount)}
              </Text>
            )}
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
      </NeoCard>
    );
  };

  const renderTimeframeNavigator = () => (
    <View>
      {/* Time Horizon Slider (Clean Neobrutalist Horizon Capsule) */}
      <View style={styles.timeframeSegmentContainer}>
        {/* Double-Headed Arrow Guide Line */}
        <View style={styles.horizonDoubleArrowContainer}>
          <ChevronLeft size={11} color="rgba(59, 51, 48, 0.4)" strokeWidth={2.2} />
          <View style={{ flex: 1, height: 2, marginHorizontal: 6, justifyContent: "center" }}>
            <Svg height="2" width="100%">
              <Line
                x1="0"
                y1="1"
                x2="100%"
                y2="1"
                stroke="rgba(59, 51, 48, 0.28)"
                strokeWidth="1"
                strokeDasharray="3, 3"
              />
            </Svg>
          </View>
          <ChevronRight size={11} color="rgba(59, 51, 48, 0.4)" strokeWidth={2.2} />
        </View>

        {/* Clean Pill Button with Swipe Support */}
        <View style={{ position: "relative", width: "100%" }}>
          {/* Neobrutalist underlay for Daily View capsule - unclipped inset layout */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 3,
              left: 2,
              right: 0,
              bottom: 0,
              borderRadius: 9999,
              backgroundColor: COLORS.ink,
            }}
          />
          <Animated.View
            {...swipePanResponder.panHandlers}
            style={[
              styles.horizonCard,
              {
                marginRight: 2,
                marginBottom: 3,
                backgroundColor:
                  timeframeMode === "daily"
                    ? COLORS.butter
                    : timeframeMode === "week"
                    ? COLORS.mint
                    : timeframeMode === "month"
                    ? COLORS.peach
                    : COLORS.lavender,
                transform: [{ translateX: swipeCardAnim }],
              },
            ]}
          >
            {/* Left Arrow Button */}
            <Pressable
              onPress={() => handleStepHorizon(-1)}
              disabled={timeframeMode === "daily"}
              style={[
                styles.horizonArrowBtn,
                timeframeMode === "daily" && styles.horizonArrowDisabled,
              ]}
              hitSlop={8}
              accessibilityLabel="Swipe or tap to go to previous timeframe"
            >
              <ChevronLeft
                size={15}
                color={COLORS.ink}
                strokeWidth={2.4}
              />
            </Pressable>

            {/* Center Title & Icon */}
            <View style={styles.horizonCenter}>
              <View style={styles.horizonTitleRow}>
                {timeframeMode === "daily" && (
                  <Sun size={14} color={COLORS.ink} strokeWidth={2.4} />
                )}
                {timeframeMode === "week" && (
                  <Clock size={14} color={COLORS.ink} strokeWidth={2.4} />
                )}
                {timeframeMode === "month" && (
                  <Calendar size={14} color={COLORS.ink} strokeWidth={2.4} />
                )}
                {timeframeMode === "history" && (
                  <Archive size={14} color={COLORS.ink} strokeWidth={2.4} />
                )}
                <Text style={styles.horizonTitleText}>
                  {timeframeMode === "daily"
                    ? "Daily View"
                    : timeframeMode === "week"
                    ? "Week View"
                    : timeframeMode === "month"
                    ? "Month View"
                    : "All History"}
                </Text>
              </View>
            </View>

            {/* Right Arrow Button */}
            <Pressable
              onPress={() => handleStepHorizon(1)}
              disabled={timeframeMode === "history"}
              style={[
                styles.horizonArrowBtn,
                timeframeMode === "history" && styles.horizonArrowDisabled,
              ]}
              hitSlop={8}
              accessibilityLabel="Swipe or tap to go to next timeframe"
            >
              <ChevronRight
                size={15}
                color={COLORS.ink}
                strokeWidth={2.4}
              />
            </Pressable>
          </Animated.View>
        </View>

        {/* Horizon Indicator Dots (Underneath the card) */}
        <View style={styles.horizonDotsContainer}>
          {MODES_LIST.map((m) => (
            <View
              key={m}
              style={[
                styles.horizonDot,
                timeframeMode === m && styles.horizonDotActive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Period Navigator Bar */}
      {currentRange && (
        <View style={styles.periodNavigatorBar}>
          <View style={{ position: "relative" }}>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 2,
                left: 1.5,
                right: 0,
                bottom: 0,
                borderRadius: 16,
                backgroundColor: COLORS.ink,
              }}
            />
            <Pressable
              onPress={() => handleShiftPeriod(-1)}
              style={[styles.periodArrowBtn, { marginRight: 1.5, marginBottom: 2 }]}
              hitSlop={8}
              accessibilityLabel="Previous day or period"
            >
              <ChevronLeft size={16} color={COLORS.ink} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.periodCenterInfo}>
            <Text style={styles.periodLabelMain}>
              {periodLabelParts.main}{" "}
              {periodLabelParts.sub ? (
                <Text style={styles.periodLabelSub}>{periodLabelParts.sub}</Text>
              ) : null}
            </Text>
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

          <View style={{ position: "relative" }}>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 2,
                left: 1.5,
                right: 0,
                bottom: 0,
                borderRadius: 16,
                backgroundColor: COLORS.ink,
              }}
            />
            <Pressable
              onPress={() => handleShiftPeriod(1)}
              style={[styles.periodArrowBtn, { marginRight: 1.5, marginBottom: 2 }]}
              hitSlop={8}
              accessibilityLabel="Next day or period"
            >
              <ChevronRight size={16} color={COLORS.ink} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );

  const renderListHeader = () => (
    <View>
      {/* App Header */}
      <View style={styles.header}>
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
          <PocketBrandIcon
            size={isCompact ? 38 : 44}
            currencySymbol={currency.symbol}
          />
          <View>
            <Text style={[styles.brandTitle, isCompact && { fontSize: 18, lineHeight: 20 }]}>pocket.</Text>
            <Text style={styles.brandSubtitle}>penny journal</Text>
          </View>
        </Pressable>

        <View style={[styles.headerRight, isCompact && { gap: 6 }]}>


          <View style={{ position: "relative" }}>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 2,
                left: 1,
                right: 0,
                bottom: 0,
                borderRadius: isCompact ? 10 : 14,
                backgroundColor: "rgba(59, 51, 48, 0.25)",
              }}
            />
            <Pressable
              onPress={() => {
                safeHaptic.selection();
                setShowCloudModal(true);
              }}
              style={[
                styles.headerIconButton,
                isCompact && { width: 30, height: 30, borderRadius: 10 },
                { marginRight: 1, marginBottom: 2 },
              ]}
              hitSlop={8}
              accessibilityLabel="Open Cloud Sync & Backup"
            >
              <Cloud size={isCompact ? 14 : 15} color={COLORS.ink} strokeWidth={2.2} />
            </Pressable>
          </View>

          <View style={{ position: "relative" }}>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 2,
                left: 1,
                right: 0,
                bottom: 0,
                borderRadius: isCompact ? 10 : 14,
                backgroundColor: "rgba(59, 51, 48, 0.25)",
              }}
            />
            <Pressable
              onPress={() => {
                safeHaptic.selection();
                setShowSearch((prev) => !prev);
              }}
              style={[
                styles.headerIconButton,
                isCompact && { width: 30, height: 30, borderRadius: 10 },
                showSearch && { backgroundColor: COLORS.ink, borderColor: COLORS.ink },
                { marginRight: 1, marginBottom: 2 },
              ]}
            >
              <Search
                size={isCompact ? 14 : 15}
                color={showSearch ? COLORS.cream : COLORS.ink}
                strokeWidth={2.2}
              />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Expandable Search Input */}
      {showSearch && (
        <View style={styles.searchBarContainer}>
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

      {/* Reusable Time Horizon & Period Navigator */}
      {renderTimeframeNavigator()}

      {/* Dynamic Balance Hero Card - Swipe horizontally to change time horizon */}
      <NeoCard
        {...swipePanResponder.panHandlers}
        shadowOffsetX={3.5}
        shadowOffsetY={4.5}
        borderRadius={26}
        style={[styles.heroCardContent, isCompact && { padding: 14 }]}
      >
        <View style={styles.cardTopRow}>
          <Text style={[styles.cardEyebrow, isCompact && { fontSize: 10 }]}>{heroEyebrow}</Text>
          <View style={styles.sparkleBadge}>
            <Text style={styles.sparkleText}>sparkle ✿</Text>
          </View>
        </View>

        {/* Amount Display */}
        <View style={styles.balanceRow}>
          <Text
            style={[
              styles.balanceBigText,
              isCompact && { fontSize: 36, lineHeight: 40 },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {scopedTotals.balance < 0 ? `−${currency.symbol}` : currency.symbol}
            {balanceWhole.toLocaleString("en-US")}
          </Text>
          <Text style={[styles.balanceCentsText, isCompact && { fontSize: 22 }]}>.{balanceCents}</Text>
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
      </NeoCard>

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
                borderColor: selectedTag === null ? COLORS.ink : "rgba(59, 51, 48, 0.2)",
                borderWidth: selectedTag === null ? 1.5 : 1,
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
          {(selectedTypeFilter === "income"
            ? INCOME_CATEGORIES
            : selectedTypeFilter === "expense"
            ? EXPENSE_CATEGORIES
            : CATEGORIES
          ).map((c) => {
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
                    borderColor: active ? COLORS.ink : "rgba(59, 51, 48, 0.2)",
                    borderWidth: active ? 1.5 : 1,
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
      <NeoCard
        shadowOffsetX={3}
        shadowOffsetY={4}
        borderRadius={24}
        style={styles.emptyCard}
      >
        <View style={styles.emptyEmojiBox}>
          <Text style={styles.emptyEmoji}>📒</Text>
        </View>
        <Text style={styles.emptyTitle}>no entries in this period</Text>
        <Text style={styles.emptySubtitle}>
          {selectedTag || selectedTypeFilter || searchQuery
            ? "Try clearing filters or changing the period 🌸"
            : "Tap “+ Add Entry” below to log something 🌸"}
        </Text>
      </NeoCard>
    );
  };

  const renderListFooter = () => (
    <NeoCard
      shadowOffsetX={3}
      shadowOffsetY={3}
      borderRadius={24}
      backgroundColor="#F1EEFB"
      style={styles.quoteCard}
    >
      <View style={styles.quoteContentRow}>
        <Text style={styles.quoteSparkleEmoji}>✨</Text>
        <View style={styles.quoteTextCol}>
          <Text style={styles.quoteText}>
            “a steady life, a penny saved is a future paved with calm.”
          </Text>
          <Text style={styles.quoteAuthor}>— the pocket journal prompt</Text>
        </View>
      </View>
    </NeoCard>
  );

  // Category spending distribution for Insights Tab
  const categoryExpenseBreakdown = useMemo(() => {
    const expenses = (scopedTxns || []).filter((t) => t.type === "expense");
    const totalExp = scopedTotals?.spent || 1;
    const catMap: Record<string, { amount: number; count: number }> = {};
    for (const t of expenses) {
      if (!catMap[t.category]) {
        catMap[t.category] = { amount: 0, count: 0 };
      }
      catMap[t.category].amount += t.amount;
      catMap[t.category].count += 1;
    }
    return Object.entries(catMap)
      .map(([key, data]) => {
        const catInfo = ALL_CATEGORIES.find((c) => c.key === key) || {
          key,
          label: key,
          emoji: "💸",
          bg: "butter" as const,
        };
        const percentage = Math.round((data.amount / totalExp) * 100);
        return {
          ...catInfo,
          amount: data.amount,
          count: data.count,
          percentage,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [scopedTxns, scopedTotals?.spent]);

  // Donut chart data for Insights Tab
  const donutChartData = useMemo(() => {
    return categoryExpenseBreakdown.map((item, idx) => ({
      key: item.key,
      label: item.label,
      emoji: item.emoji,
      amount: item.amount,
      count: item.count,
      percentage: item.percentage,
      color: getCategorySliceColor(idx, item.bg),
      bg: item.bg,
    }));
  }, [categoryExpenseBreakdown]);

  // Key metrics for Insights Tab
  const insightsMetrics = useMemo(() => {
    const expenses = (scopedTxns || []).filter((t) => t.type === "expense");
    const count = expenses.length;
    const total = scopedTotals?.spent || 0;
    const topCategory = categoryExpenseBreakdown[0] || null;
    const avgPerEntry = count > 0 ? total / count : 0;

    let periodLabel = "ENTRIES";
    let burnRate = count;
    if (timeframeMode === "month") {
      periodLabel = "DAILY BURN";
      burnRate = total > 0 ? Math.round(total / 30) : 0;
    } else if (timeframeMode === "week") {
      periodLabel = "DAILY BURN";
      burnRate = total > 0 ? Math.round(total / 7) : 0;
    } else if (timeframeMode === "history") {
      periodLabel = "ALL ENTRIES";
      burnRate = count;
    }

    return {
      count,
      total,
      topCategory,
      avgPerEntry,
      periodLabel,
      burnRate,
    };
  }, [scopedTxns, scopedTotals?.spent, categoryExpenseBreakdown, timeframeMode]);

  // Insights Tab Component
  const renderInsightsTab = () => {
    const hasExpenses = categoryExpenseBreakdown.length > 0;

    return (
      <ScrollView
        style={{ flex: 1, width: "100%" }}
        contentContainerStyle={{
          ...styles.scrollContent,
          paddingHorizontal: horizontalPad,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 95,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tabScreenHeader}>
          <Text style={styles.tabScreenTitle}>Spending Insights 📊</Text>
          <Text style={styles.tabScreenSubtitle}>Where your pennies traveled in this period</Text>
        </View>

        {/* Time Horizon & Period Navigator (Shared with Journal) */}
        <View style={{ marginBottom: 16 }}>
          {renderTimeframeNavigator()}
        </View>

        {!hasExpenses ? (
          <NeoCard
            shadowOffsetX={3}
            shadowOffsetY={4}
            borderRadius={24}
            style={styles.emptyCard}
          >
            <View style={styles.emptyEmojiBox}>
              <Text style={styles.emptyEmoji}>🍰</Text>
            </View>
            <Text style={styles.emptyTitle}>no expenses in this period</Text>
            <Text style={styles.emptySubtitle}>Log an expense to see your spending breakdown 🌸</Text>
          </NeoCard>
        ) : (
          <>
            {/* Key Financial Highlights Row */}
            <View style={styles.insightHighlightsRow}>
              {/* Top Category */}
              <View style={[styles.insightHighlightCard, { backgroundColor: COLORS.butter }]}>
                <Text style={styles.insightHighlightEyebrow}>TOP SPEND</Text>
                <Text style={styles.insightHighlightTitle} numberOfLines={1}>
                  {insightsMetrics.topCategory ? `${insightsMetrics.topCategory.emoji} ${insightsMetrics.topCategory.label}` : "None"}
                </Text>
                <Text style={styles.insightHighlightSub}>
                  {insightsMetrics.topCategory ? `${insightsMetrics.topCategory.percentage}% of spent` : "—"}
                </Text>
              </View>

              {/* Avg per entry */}
              <View style={[styles.insightHighlightCard, { backgroundColor: COLORS.mint }]}>
                <Text style={styles.insightHighlightEyebrow}>AVG / ENTRY</Text>
                <Text style={styles.insightHighlightTitle} numberOfLines={1}>
                  {currency.symbol}{fmt(insightsMetrics.avgPerEntry)}
                </Text>
                <Text style={styles.insightHighlightSub}>
                  {insightsMetrics.count} {insightsMetrics.count === 1 ? "entry" : "entries"}
                </Text>
              </View>

              {/* Daily Burn / Rate */}
              <View style={[styles.insightHighlightCard, { backgroundColor: COLORS.lavender }]}>
                <Text style={styles.insightHighlightEyebrow}>{insightsMetrics.periodLabel}</Text>
                <Text style={styles.insightHighlightTitle} numberOfLines={1}>
                  {insightsMetrics.periodLabel.includes("BURN") || insightsMetrics.periodLabel.includes("AVG")
                    ? `${currency.symbol}${fmt(insightsMetrics.burnRate)}`
                    : `${insightsMetrics.burnRate}`}
                </Text>
                <Text style={styles.insightHighlightSub}>
                  {timeframeMode === "daily" ? "logged today" : "per day avg"}
                </Text>
              </View>
            </View>

            {/* Donut Chart Visualizer Card */}
            <NeoCard
              shadowOffsetX={3}
              shadowOffsetY={4}
              borderRadius={24}
              backgroundColor={COLORS.cream}
              style={[styles.donutSectionCard, { marginBottom: 18 }]}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.cardEyebrow}>SPENDING DISTRIBUTION</Text>
                {selectedInsightCategory ? (
                  <Pressable
                    onPress={() => {
                      safeHaptic.selection();
                      setSelectedInsightCategory(null);
                    }}
                    style={styles.resetFilterPill}
                  >
                    <Text style={styles.resetFilterPillText}>Reset ✕</Text>
                  </Pressable>
                ) : (
                  <View style={styles.sparkleBadge}>
                    <Text style={styles.sparkleText}>tap to focus ✿</Text>
                  </View>
                )}
              </View>

              <View style={styles.donutChartContainer}>
                <InsightsDonutChart
                  data={donutChartData}
                  totalSpent={scopedTotals.spent}
                  currencySymbol={currency.symbol}
                  selectedCategoryKey={selectedInsightCategory}
                  onSelectCategory={(key) => {
                    safeHaptic.selection();
                    setSelectedInsightCategory((prev) => (prev === key ? null : key));
                    setExpandedInsightCategory((prev) => (prev === key ? null : key));
                  }}
                  size={isCompact ? 220 : 250}
                  donutThickness={isCompact ? 38 : 44}
                />
              </View>

              {/* Multi-Segment Proportion Bar (Battery Tracker) */}
              <View style={styles.multiBarContainer}>
                <View style={styles.multiBarTrack}>
                  {donutChartData.map((item) => (
                    <Pressable
                      key={item.key}
                      onPress={() => {
                        safeHaptic.selection();
                        setSelectedInsightCategory((prev) => (prev === item.key ? null : item.key));
                        setExpandedInsightCategory((prev) => (prev === item.key ? null : item.key));
                      }}
                      style={{
                        height: "100%",
                        width: `${Math.max(item.percentage, 2)}%`,
                        backgroundColor: item.color,
                        opacity: selectedInsightCategory && selectedInsightCategory !== item.key ? 0.35 : 1,
                      }}
                    />
                  ))}
                </View>
                <View style={styles.multiBarHintRow}>
                  <Text style={styles.multiBarHintText}>
                    {selectedInsightCategory
                      ? `Viewing ${donutChartData.find((d) => d.key === selectedInsightCategory)?.label || "selected"}`
                      : `${donutChartData.length} ${donutChartData.length === 1 ? "category" : "categories"} active`}
                  </Text>
                  <Text style={styles.multiBarHintText}>
                    Total: {currency.symbol}{fmt(scopedTotals.spent)}
                  </Text>
                </View>
              </View>
            </NeoCard>

            {/* Category Breakdown & Transaction Drilldown Header */}
            <View style={[styles.listHeaderRow, { marginBottom: 12 }]}>
              <Text style={styles.listHeaderTitle}>CATEGORY BREAKDOWN & ENTRIES</Text>
              <Text style={styles.listHeaderSubtitle}>Tap to inspect</Text>
            </View>

            {categoryExpenseBreakdown.map((item, idx) => {
              const sliceColor = getCategorySliceColor(idx, item.bg);
              const isSelected = selectedInsightCategory === item.key;
              const isExpanded = expandedInsightCategory === item.key;
              const catTxns = isExpanded ? (scopedTxns || []).filter((t) => t.type === "expense" && t.category === item.key) : [];

              return (
                <View key={item.key} style={{ marginBottom: 10 }}>
                  <NeoCard
                    shadowOffsetX={isSelected ? 3 : 2}
                    shadowOffsetY={isSelected ? 3.5 : 2.5}
                    borderRadius={18}
                    backgroundColor={isSelected ? "#FFFDF5" : COLORS.cream}
                    borderColor={isSelected ? sliceColor : COLORS.cardBorder}
                    borderWidth={isSelected ? 2 : 1.5}
                    style={styles.insightCard}
                  >
                    <Pressable
                      onPress={() => {
                        safeHaptic.selection();
                        setSelectedInsightCategory((prev) => (prev === item.key ? null : item.key));
                        setExpandedInsightCategory((prev) => (prev === item.key ? null : item.key));
                      }}
                      style={{ width: "100%" }}
                    >
                      <View style={styles.insightTopRow}>
                        <View style={styles.insightLeftRow}>
                          <View style={[styles.txnIconBox, { backgroundColor: sliceColor }]}>
                            <Text style={styles.txnEmoji}>{item.emoji}</Text>
                          </View>
                          <View style={{ marginLeft: 10 }}>
                            <Text style={styles.insightCatName}>{item.label}</Text>
                            <Text style={styles.insightCatMeta}>
                              {item.count} {item.count === 1 ? "entry" : "entries"}
                            </Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <View style={{ alignItems: "flex-end", marginRight: 8 }}>
                            <Text style={styles.insightAmount}>−{currency.symbol}{fmt(item.amount)}</Text>
                            <Text style={styles.insightPercentage}>{item.percentage}% of spent</Text>
                          </View>
                          <ChevronDown
                            size={16}
                            color={COLORS.ink}
                            style={{
                              transform: [{ rotate: isExpanded ? "180deg" : "0deg" }],
                            }}
                          />
                        </View>
                      </View>

                      <View style={styles.insightBarTrack}>
                        <View
                          style={[
                            styles.insightBarFill,
                            {
                              width: `${Math.min(item.percentage, 100)}%`,
                              backgroundColor: sliceColor,
                            },
                          ]}
                        />
                      </View>
                    </Pressable>

                    {/* Drilldown Accordion for this Category */}
                    {isExpanded && (
                      <View style={styles.insightDrilldownContainer}>
                        <View style={styles.drilldownHeader}>
                          <Text style={styles.drilldownHeaderText}>Entries in this period ({catTxns.length}):</Text>
                        </View>
                        {catTxns.length === 0 ? (
                          <Text style={[styles.emptySubtitle, { textAlign: "left", marginVertical: 6 }]}>
                            No entries found.
                          </Text>
                        ) : (
                          catTxns.map((t) => (
                            <Pressable
                              key={t.id}
                              onPress={() => handleOpenEdit(t)}
                              style={styles.insightDrilldownRow}
                            >
                              <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={styles.insightDrilldownNote} numberOfLines={1}>
                                  {t.note ? t.note : item.label}
                                </Text>
                                <Text style={styles.insightDrilldownDate}>
                                  {formatShortDate(t.date)}
                                </Text>
                              </View>
                              <View style={{ flexDirection: "row", alignItems: "center" }}>
                                <Text style={styles.insightDrilldownAmount}>
                                  −{currency.symbol}{fmt(t.amount)}
                                </Text>
                                <Edit2 size={13} color="rgba(59, 51, 48, 0.45)" style={{ marginLeft: 6 }} />
                              </View>
                            </Pressable>
                          ))
                        )}
                      </View>
                    )}
                  </NeoCard>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    );
  };

  // Piggy Tab Component
  const renderPiggyTab = () => {
    const netSavings = scopedTotals.income - scopedTotals.spent;
    const isPositive = netSavings >= 0;
    const savingsRate = scopedTotals.income > 0 ? Math.round((Math.max(0, netSavings) / scopedTotals.income) * 100) : 0;

    return (
      <ScrollView
        style={{ flex: 1, width: "100%" }}
        contentContainerStyle={{
          ...styles.scrollContent,
          paddingHorizontal: horizontalPad,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 95,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tabScreenHeader}>
          <Text style={styles.tabScreenTitle}>Piggy Bank 🐷</Text>
          <Text style={styles.tabScreenSubtitle}>Nurturing calm and consistent savings</Text>
        </View>

        <NeoCard
          shadowOffsetX={3}
          shadowOffsetY={4}
          borderRadius={24}
          style={[styles.heroCardContent, { marginBottom: 16 }]}
        >
          <View style={styles.cardTopRow}>
            <Text style={styles.cardEyebrow}>NET SAVINGS THIS PERIOD</Text>
            <View style={[styles.sparkleBadge, { backgroundColor: isPositive ? "#D4F0E3" : "#FFE0D6" }]}>
              <Text style={styles.sparkleText}>{isPositive ? "healthy ✿" : "deficit ✿"}</Text>
            </View>
          </View>
          <Text style={[styles.balanceBigText, { color: isPositive ? "#2D8C65" : "#D35433", marginTop: 8 }]}>
            {isPositive ? "+" : "−"}{currency.symbol}{fmt(Math.abs(netSavings))}
          </Text>
          <Text style={[styles.emptySubtitle, { textAlign: "left", marginTop: 4 }]}>
            Savings rate: {savingsRate}% of total income
          </Text>
        </NeoCard>

        <NeoCard
          shadowOffsetX={3}
          shadowOffsetY={4}
          borderRadius={24}
          style={styles.emptyCard}
        >
          <View style={[styles.emptyEmojiBox, { backgroundColor: "#FFE0D6", borderColor: "#FFA08A" }]}>
            <Text style={styles.emptyEmoji}>🪙</Text>
          </View>
          <Text style={styles.emptyTitle}>Every Penny Matters</Text>
          <Text style={[styles.emptySubtitle, { textAlign: "center", paddingHorizontal: 16 }]}>
            “Small daily economies compound into quiet financial freedom. Keep tucking pennies into your journal.”
          </Text>
        </NeoCard>
      </ScrollView>
    );
  };

  // Me Tab Component
  const renderMeTab = () => {
    return (
      <ScrollView
        style={{ flex: 1, width: "100%" }}
        contentContainerStyle={{
          ...styles.scrollContent,
          paddingHorizontal: horizontalPad,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 95,
        }}
        showsVerticalScrollIndicator={false}
      >
        {meSubPage === "updates" && (
          <View>
            <View style={styles.subPageHeader}>
              <Pressable
                onPress={() => {
                  safeHaptic.light();
                  setMeSubPage("main");
                }}
                style={styles.subPageBackButton}
                hitSlop={8}
                accessibilityLabel="Back to Notebook"
              >
                <ChevronLeft size={20} color={COLORS.ink} strokeWidth={2.4} />
              </Pressable>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.tabScreenTitle}>Updates & Safety 🛡️</Text>
                <Text style={styles.tabScreenSubtitle}>Version check & data protection</Text>
              </View>
            </View>

            {/* Version NeoCard */}
            <NeoCard
              shadowOffsetX={2}
              shadowOffsetY={2.5}
              borderRadius={20}
              backgroundColor={COLORS.cream}
              style={{ padding: 14, marginBottom: 14 }}
            >
              <View style={styles.settingItemRow}>
                <View style={[styles.settingIconBox, { backgroundColor: "#E6FAF0" }]}>
                  <Smartphone size={16} color="#2D8C65" strokeWidth={2.2} />
                </View>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingTitle}>Installed Version</Text>
                  <Text style={styles.settingDesc}>Pocket Penny Journal</Text>
                </View>
                <View style={[styles.pillTag, { backgroundColor: COLORS.butter }]}>
                  <Text style={styles.pillTagText}>v{currentVersion}</Text>
                </View>
              </View>
            </NeoCard>

            {/* Zero Data Loss Guarantee Card */}
            <NeoCard
              shadowOffsetX={2}
              shadowOffsetY={2.5}
              borderRadius={20}
              backgroundColor="#E8F8F0"
              borderColor="#2D8C65"
              style={{ padding: 14, marginBottom: 14 }}
            >
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <View style={styles.guaranteeIconCircle}>
                  <ShieldCheck size={16} color="#2D8C65" strokeWidth={2.4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guaranteeTitle}>Safe Updates Guaranteed</Text>
                  <Text style={styles.guaranteeBody}>
                    Updates install smoothly without erasing your entries. Your journal and balance are always protected on your device.
                  </Text>
                </View>
              </View>
            </NeoCard>

            {/* Manual Update Check Button */}
            <Pressable
              onPress={handleManualCheckUpdate}
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
                  <RefreshCw size={15} color={COLORS.cream} strokeWidth={2.2} />
                  <Text style={styles.updateButtonText}>Check for Updates Now</Text>
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
                  { marginTop: 14 },
                ]}
              >
                <Check
                  size={16}
                  color={updateNotice.type === "success" ? "#2D8C65" : COLORS.ink}
                  strokeWidth={2.2}
                />
                <Text
                  style={[
                    styles.noticeText,
                    {
                      color: updateNotice.type === "success" ? "#1F6347" : COLORS.ink,
                    },
                  ]}
                >
                  {updateNotice.message}
                </Text>
              </View>
            )}
          </View>
        )}

        {meSubPage === "about" && (
          <View>
            <View style={styles.subPageHeader}>
              <Pressable
                onPress={() => {
                  safeHaptic.light();
                  setMeSubPage("main");
                }}
                style={styles.subPageBackButton}
                hitSlop={8}
                accessibilityLabel="Back to Notebook"
              >
                <ChevronLeft size={20} color={COLORS.ink} strokeWidth={2.4} />
              </Pressable>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.tabScreenTitle}>About Pocket ✿</Text>
                <Text style={styles.tabScreenSubtitle}>Mindful money & offline design</Text>
              </View>
            </View>

            <NeoCard
              shadowOffsetX={2}
              shadowOffsetY={2.5}
              borderRadius={20}
              backgroundColor={COLORS.cream}
              style={{ padding: 16, marginBottom: 14 }}
            >
              <Text style={styles.aboutHeadline}>
                A simple, private way to track your spending.
              </Text>
              <Text style={styles.aboutBody}>
                Pocket helps you build mindful money habits by noting your daily expenses and income in just a few taps. No ads, no tracking, and no account needed.
              </Text>

              <View style={styles.rowDivider} />

              <View style={styles.aboutFeatureList}>
                <View style={styles.aboutFeatureRow}>
                  <View style={[styles.aboutFeatureIconBox, { backgroundColor: "#E6FAF0" }]}>
                    <ShieldCheck size={16} color="#2D8C65" strokeWidth={2.4} />
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
                    <Sparkles size={16} color="#B45309" strokeWidth={2.4} />
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
                    <Cloud size={16} color="#7A5299" strokeWidth={2.4} />
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

              <View style={styles.systemInfoRow}>
                <Text style={styles.systemLabel}>App Version</Text>
                <Text style={styles.systemVal}>v{currentVersion}</Text>
              </View>
              <View style={styles.systemInfoRow}>
                <Text style={styles.systemLabel}>Storage Engine</Text>
                <Text style={styles.systemVal}>Local SQLite</Text>
              </View>
              <View style={[styles.systemInfoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.systemLabel}>Philosophy</Text>
                <Text style={styles.systemVal}>Calm & Offline</Text>
              </View>
            </NeoCard>

            <View style={styles.modalFooter}>
              <Text style={styles.footerNoteText}>
                crafted with care · offline & private by design ✿
              </Text>
            </View>
          </View>
        )}

        {meSubPage === "currency" && (
          <View>
            <View style={styles.subPageHeader}>
              <Pressable
                onPress={() => {
                  safeHaptic.light();
                  setMeSubPage("main");
                  setCurrencySearch("");
                }}
                style={styles.subPageBackButton}
                hitSlop={8}
                accessibilityLabel="Back to Notebook"
              >
                <ChevronLeft size={20} color={COLORS.ink} strokeWidth={2.4} />
              </Pressable>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.tabScreenTitle}>Select Currency 🪙</Text>
                <Text style={styles.tabScreenSubtitle}>Default for balance & entries</Text>
              </View>
            </View>

            {/* Search Input */}
            <View style={styles.currencySearchBar}>
              <Search size={15} color={COLORS.inkSoft} strokeWidth={2.2} />
              <TextInput
                value={currencySearch}
                onChangeText={setCurrencySearch}
                placeholder="Search currency, code or country..."
                placeholderTextColor={COLORS.inkSoft}
                style={styles.currencySearchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {currencySearch.length > 0 && (
                <Pressable
                  onPress={() => setCurrencySearch("")}
                  hitSlop={8}
                  style={styles.currencyClearSearchBtn}
                >
                  <X size={14} color={COLORS.inkSoft} />
                </Pressable>
              )}
            </View>

            {/* Currency List */}
            <View style={{ gap: 8, marginTop: 12 }}>
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
                        handleSelectCurrency(curr);
                        setMeSubPage("main");
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
            </View>
          </View>
        )}

        {meSubPage === "main" && (
          <View>
            <View style={styles.tabScreenHeader}>
              <Text style={styles.tabScreenTitle}>My Notebook 📖</Text>
              <Text style={styles.tabScreenSubtitle}>Preferences, system, and backups</Text>
            </View>

            {/* Hero Pocket Branding Card */}
            <NeoCard
              shadowOffsetX={3}
              shadowOffsetY={4}
              borderRadius={24}
              backgroundColor={COLORS.cream}
              style={[styles.heroCardContent, { marginBottom: 16 }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <PocketBrandIcon size={44} currencySymbol={currency.symbol} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={styles.brandTitle}>pocket.</Text>
                    <View style={styles.heroVersionBadge}>
                      <Text style={styles.heroVersionText}>v{currentVersion}</Text>
                    </View>
                  </View>
                  <Text style={styles.brandSubtitle}>
                    penny journal · {txns.length} entries recorded
                  </Text>
                </View>
              </View>

              <View style={styles.heroMottoBox}>
                <Sparkles size={12} color="#D97706" />
                <Text style={styles.heroMottoText}>
                  "a steady little habit beats a big reset ✿"
                </Text>
              </View>
            </NeoCard>

            {/* Direct Preferences Section */}
            <View style={styles.meSectionHeader}>
              <Text style={styles.sectionEyebrow}>PREFERENCES</Text>
            </View>
            <NeoCard
              shadowOffsetX={2}
              shadowOffsetY={2.5}
              borderRadius={20}
              backgroundColor={COLORS.cream}
              style={{ padding: 14, marginBottom: 18 }}
            >
              {/* Default Currency Selector */}
              <Pressable
                onPress={() => {
                  safeHaptic.selection();
                  setMeSubPage("currency");
                }}
                style={styles.settingItemRow}
              >
                <View style={[styles.settingIconBox, { backgroundColor: "#FFF4DC" }]}>
                  <Coins size={16} color="#B45309" strokeWidth={2.2} />
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
                  <ChevronRight size={14} color={COLORS.inkSoft} strokeWidth={2.4} />
                </View>
              </Pressable>

              <View style={styles.rowDivider} />

              {/* Live Rate Conversion Switch */}
              <Pressable
                onPress={() => {
                  safeHaptic.selection();
                  handleToggleLiveConversion(!liveConversionEnabled);
                }}
                style={styles.settingItemRow}
              >
                <View style={[styles.settingIconBox, { backgroundColor: "#EBF3FE" }]}>
                  <ArrowLeftRight size={16} color="#2563EB" strokeWidth={2.2} />
                </View>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingTitle}>Live Conversion</Text>
                  <Text style={styles.settingDesc}>
                    {liveConversionEnabled
                      ? "Converts amounts using live market rates"
                      : "Changes symbol only (keeps raw amount)"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.toggleSwitchTrack,
                    liveConversionEnabled && styles.toggleSwitchTrackActive,
                  ]}
                >
                  <View
                    style={[
                      styles.toggleSwitchThumb,
                      liveConversionEnabled && styles.toggleSwitchThumbActive,
                    ]}
                  />
                </View>
              </Pressable>
            </NeoCard>

            {/* System & About Navigation Hub */}
            <View style={styles.meSectionHeader}>
              <Text style={styles.sectionEyebrow}>SYSTEM & ABOUT</Text>
            </View>
            <View style={{ gap: 10, marginBottom: 20 }}>
              {/* App Updates & Safety */}
              <NeoCard
                onPress={() => {
                  safeHaptic.selection();
                  setMeSubPage("updates");
                }}
                shadowOffsetX={2}
                shadowOffsetY={2}
                borderRadius={18}
                backgroundColor={COLORS.cream}
                style={[styles.txnCard, { justifyContent: "space-between" }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                  <View style={[styles.settingIconBox, { backgroundColor: "#E6FAF0" }]}>
                    <Smartphone size={16} color="#2D8C65" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>App Updates & Safety</Text>
                    <Text style={styles.settingDesc}>v{currentVersion} · Safe update guarantee</Text>
                  </View>
                </View>
                <ChevronRight size={18} color={COLORS.inkSoft} />
              </NeoCard>

              {/* About Pocket */}
              <NeoCard
                onPress={() => {
                  safeHaptic.selection();
                  setMeSubPage("about");
                }}
                shadowOffsetX={2}
                shadowOffsetY={2}
                borderRadius={18}
                backgroundColor={COLORS.cream}
                style={[styles.txnCard, { justifyContent: "space-between" }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                  <View style={[styles.settingIconBox, { backgroundColor: "#FFF4DC" }]}>
                    <Sparkles size={16} color="#B45309" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>About Pocket</Text>
                    <Text style={styles.settingDesc}>Privacy, mindful logging & story</Text>
                  </View>
                </View>
                <ChevronRight size={18} color={COLORS.inkSoft} />
              </NeoCard>

              {/* Cloud Sync & Backup */}
              <NeoCard
                onPress={() => {
                  safeHaptic.selection();
                  setShowCloudModal(true);
                }}
                shadowOffsetX={2}
                shadowOffsetY={2}
                borderRadius={18}
                backgroundColor={COLORS.cream}
                style={[styles.txnCard, { justifyContent: "space-between" }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                  <View style={[styles.settingIconBox, { backgroundColor: "#F3EEFF" }]}>
                    <Cloud size={16} color="#7A5299" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>Cloud Sync & Backup</Text>
                    <Text style={styles.settingDesc}>Multi-device backups & restore</Text>
                  </View>
                </View>
                <ChevronRight size={18} color={COLORS.inkSoft} />
              </NeoCard>
            </View>

            {/* Danger Zone Section */}
            <View style={[styles.meSectionHeader, { marginTop: 6 }]}>
              <Text style={[styles.sectionEyebrow, { color: "#C53030" }]}>DANGER ZONE</Text>
            </View>
            <View style={{ marginBottom: 28 }}>
              <NeoCard
                onPress={() => {
                  safeHaptic.warning();
                  setResetConfirmText("");
                  setShowResetConfirm(true);
                }}
                shadowOffsetX={2}
                shadowOffsetY={2}
                borderRadius={18}
                backgroundColor="#FFF5F5"
                style={[styles.txnCard, { justifyContent: "space-between", borderColor: "#FEB2B2" }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                  <View style={[styles.settingIconBox, { backgroundColor: "#FED7D7" }]}>
                    <RotateCcw size={16} color="#C53030" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingTitle, { color: "#C53030" }]}>Reset Journal</Text>
                    <Text style={[styles.settingDesc, { color: "#9B2C2C" }]}>
                      Permanently wipe all transactions & history
                    </Text>
                  </View>
                </View>
                <ChevronRight size={18} color="#C53030" />
              </NeoCard>
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

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
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
                marginBottom: 16,
                alignItems: "center",
                justifyContent: "center",
              },
            ]}
          >
            <PocketBrandIcon
              size={88}
              currencySymbol={currency.symbol}
            />
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
    <View style={styles.container}>
      {activeBottomTab === "journal" && (
        <FlashList
          ref={scrollRef}
          data={feedItems}
          renderItem={renderFeedItem}
          keyExtractor={(item) => item.id}
          getItemType={(item) => item.type}
          alwaysBounceVertical={true}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1, width: "100%" }}
          contentContainerStyle={{
            ...styles.scrollContent,
            paddingHorizontal: horizontalPad,
            paddingTop: insets.top + 4,
            paddingBottom: insets.bottom + 95,
          }}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderListEmpty}
          ListFooterComponent={renderListFooter}
        />
      )}

      {activeBottomTab === "insights" && renderInsightsTab()}
      {activeBottomTab === "piggy" && renderPiggyTab()}
      {activeBottomTab === "me" && renderMeTab()}

      {/* Floating Add Entry Button & Cozy Bottom Tab Bar */}
      <View
        pointerEvents="box-none"
        style={styles.bottomBarWrapper}
      >
        {/* Floating Add Entry Pill */}
        <View style={{ position: "relative", marginBottom: -18, zIndex: 35 }}>
          {/* Solid Neobrutalist Shadow Underlay */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 3.5,
              left: 2,
              right: 0,
              bottom: 0,
              borderRadius: 9999,
              backgroundColor: COLORS.ink,
            }}
          />
          <Pressable
            onPress={handleOpenCreate}
            style={({ pressed }) => [
              styles.floatingAddBtn,
              { marginRight: 2, marginBottom: 3.5 },
              pressed && {
                transform: [{ translateX: 1.5 }, { translateY: 2.5 }],
              },
            ]}
            hitSlop={8}
            accessibilityLabel="Add Entry"
          >
            <Plus size={18} color={COLORS.cream} strokeWidth={3} />
            <Text style={styles.floatingAddBtnText}>Add Entry</Text>
          </Pressable>
        </View>

        {/* Tab Navigation Footer */}
        <View
          style={[
            styles.bottomTabBar,
            { paddingBottom: Math.max(insets.bottom, 6) },
          ]}
        >
          {/* Tab: Journal */}
          <Pressable
            onPress={() => {
              safeHaptic.selection();
              setActiveBottomTab("journal");
            }}
            style={styles.bottomTabItem}
            accessibilityLabel="Journal view"
          >
            <BookOpen
              size={20}
              color={activeBottomTab === "journal" ? COLORS.ink : COLORS.inkSoft}
              strokeWidth={activeBottomTab === "journal" ? 2.5 : 2}
            />
            <Text
              style={[
                styles.bottomTabLabel,
                activeBottomTab === "journal"
                  ? styles.bottomTabLabelActive
                  : styles.bottomTabLabelInactive,
              ]}
            >
              Journal
            </Text>
          </Pressable>

          {/* Tab: Insights */}
          <Pressable
            onPress={() => {
              safeHaptic.selection();
              setActiveBottomTab("insights");
            }}
            style={styles.bottomTabItem}
            accessibilityLabel="Insights view"
          >
            <PieChart
              size={20}
              color={activeBottomTab === "insights" ? COLORS.ink : COLORS.inkSoft}
              strokeWidth={activeBottomTab === "insights" ? 2.5 : 2}
            />
            <Text
              style={[
                styles.bottomTabLabel,
                activeBottomTab === "insights"
                  ? styles.bottomTabLabelActive
                  : styles.bottomTabLabelInactive,
              ]}
            >
              Insights
            </Text>
          </Pressable>

          {/* Center Spacer to frame the floating Add button */}
          <View style={styles.bottomTabSpacer} />

          {/* Tab: Piggy */}
          <Pressable
            onPress={() => {
              safeHaptic.selection();
              setActiveBottomTab("piggy");
            }}
            style={styles.bottomTabItem}
            accessibilityLabel="Piggy savings view"
          >
            <PiggyBank
              size={20}
              color={activeBottomTab === "piggy" ? COLORS.ink : COLORS.inkSoft}
              strokeWidth={activeBottomTab === "piggy" ? 2.5 : 2}
            />
            <Text
              style={[
                styles.bottomTabLabel,
                activeBottomTab === "piggy"
                  ? styles.bottomTabLabelActive
                  : styles.bottomTabLabelInactive,
              ]}
            >
              Piggy
            </Text>
          </Pressable>

          {/* Tab: Me */}
          <Pressable
            onPress={() => {
              safeHaptic.selection();
              setActiveBottomTab("me");
              setMeSubPage("main");
            }}
            style={styles.bottomTabItem}
            accessibilityLabel="My Profile and Settings view"
          >
            <Smile
              size={20}
              color={activeBottomTab === "me" ? COLORS.ink : COLORS.inkSoft}
              strokeWidth={activeBottomTab === "me" ? 2.5 : 2}
            />
            <Text
              style={[
                styles.bottomTabLabel,
                activeBottomTab === "me"
                  ? styles.bottomTabLabelActive
                  : styles.bottomTabLabelInactive,
              ]}
            >
              Me
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Add / Edit Entry Modal */}
      <Modal
        visible={modalVisible}
        animationType="none"
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
                  if (!EXPENSE_CATEGORIES.some((c) => c.key === formCategory)) {
                    setFormCategory("food_beverage");
                  }
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
                  if (!INCOME_CATEGORIES.some((c) => c.key === formCategory)) {
                    setFormCategory("salary");
                  }
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
              {(formType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => {
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
        animationType="none"
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

      {/* In-App Reset Confirmation Modal (Destructive & Requires Typing "confirm") */}
      <Modal
        visible={showResetConfirm}
        transparent={true}
        animationType="none"
        onRequestClose={() => {
          setShowResetConfirm(false);
          setResetConfirmText("");
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.confirmModalOverlay}
        >
          <Pressable
            style={styles.confirmBackdrop}
            onPress={() => {
              setShowResetConfirm(false);
              setResetConfirmText("");
            }}
          />
          <View style={[styles.confirmDialogBox, { maxWidth: 350 }]}>
            <View style={[styles.confirmIconBubble, { backgroundColor: "#FED7D7" }]}>
              <CircleAlert size={26} color="#C53030" strokeWidth={2.4} />
            </View>
            <Text style={[styles.confirmTitle, { color: "#9B2C2C" }]}>Reset Penny Journal?</Text>

            {/* Explicit Destructive Warning Banner */}
            <View style={styles.resetWarningBanner}>
              <Text style={styles.resetWarningTitle}>⚠️ DESTRUCTIVE ACTION</Text>
              <Text style={styles.resetWarningText}>
                This will permanently delete all {txns.length} entries from this device and your cloud account. This action cannot be undone.
              </Text>
            </View>

            {/* Type "confirm" Verification Input */}
            <View style={{ width: "100%", marginVertical: 10 }}>
              <Text style={styles.resetInputLabel}>
                Type <Text style={{ fontFamily: FONTS.displayBold, color: "#C53030" }}>confirm</Text> below to proceed:
              </Text>
              <View style={styles.resetInputWrapper}>
                <TextInput
                  style={styles.resetTextInput}
                  placeholder="confirm"
                  placeholderTextColor="#A0AEC0"
                  value={resetConfirmText}
                  onChangeText={setResetConfirmText}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.confirmButtonsRow}>
              <Pressable
                onPress={() => {
                  safeHaptic.selection();
                  setShowResetConfirm(false);
                  setResetConfirmText("");
                }}
                style={styles.confirmCancelBtn}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmReset}
                disabled={resetConfirmText.trim().toLowerCase() !== "confirm"}
                style={[
                  styles.confirmDeleteBtn,
                  { backgroundColor: "#E53E3E" },
                  resetConfirmText.trim().toLowerCase() !== "confirm" && {
                    opacity: 0.45,
                    backgroundColor: "#CBD5E0",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.confirmDeleteText,
                    resetConfirmText.trim().toLowerCase() !== "confirm" && { color: "#718096" },
                  ]}
                >
                  Reset All
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    marginBottom: 10,
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
    borderWidth: 2,
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
    fontSize: 22,
    color: COLORS.ink,
    lineHeight: 24,
  },
  brandSubtitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.inkSoft,
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: COLORS.cream,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 1.5, height: 2 },
        shadowOpacity: 0.15,
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
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  horizonCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    borderRadius: 9999,
    paddingVertical: 5,
    paddingHorizontal: 12,
    height: 38,
  },
  horizonArrowBtn: {
    width: 24,
    height: 24,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  horizonArrowDisabled: {
    opacity: 0,
  },
  horizonCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  horizonDoubleArrowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  horizonArrowTrackLine: {
    flex: 1,
    height: 1,
    borderStyle: "dashed",
    borderTopWidth: 1,
    borderTopColor: "rgba(59, 51, 48, 0.22)",
    marginHorizontal: 4,
  },
  horizonTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  horizonTitleText: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: COLORS.ink,
  },
  horizonDotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 6,
  },
  horizonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(59,51,48,0.22)",
  },
  horizonDotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.ink,
  },
  periodNavigatorBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 4,
  },
  periodArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.cream,
    borderWidth: 2,
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
        elevation: 2,
      },
    }),
  },
  periodCenterInfo: {
    alignItems: "center",
  },
  periodLabelMain: {
    fontFamily: FONTS.displayBold,
    fontSize: 15,
    color: COLORS.ink,
  },
  periodLabelSub: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.inkSoft,
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
  heroCardContent: {
    padding: 20,
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
    textTransform: "uppercase",
  },
  sparkleBadge: {
    backgroundColor: "#FEF3D6",
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#FCE4A8",
    paddingHorizontal: 10,
    paddingVertical: 2.5,
  },
  sparkleText: {
    fontFamily: FONTS.displayBold,
    fontSize: 11,
    color: COLORS.ink,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 8,
  },
  balanceBigText: {
    fontFamily: FONTS.displayBold,
    fontSize: 44,
    color: COLORS.ink,
    lineHeight: 50,
  },
  balanceCentsText: {
    fontFamily: FONTS.displayBold,
    fontSize: 28,
    color: COLORS.inkSoft,
  },
  progressSection: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  progressItem: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.cream,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(59, 51, 48, 0.12)",
  },
  progressItemActive: {
    borderColor: COLORS.ink,
    borderWidth: 2,
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
    fontSize: 10,
    color: COLORS.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.8,
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
    fontSize: 15.5,
    marginVertical: 4,
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 9999,
    overflow: "hidden",
    marginTop: 6,
    backgroundColor: "#EFE7DA",
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
    fontFamily: FONTS.displayBold,
    fontSize: 12,
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
    borderColor: "rgba(59, 51, 48, 0.25)",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
    shadowColor: COLORS.ink,
    shadowOffset: { width: 1, height: 1.5 },
    shadowOpacity: 0.1,
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
    textTransform: "uppercase",
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
    fontSize: 10,
    fontStyle: "italic",
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
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 3, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  emptyEmojiBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#FEF3D6",
    borderWidth: 1,
    borderColor: "#FCE4A8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyEmoji: {
    fontSize: 26,
  },
  emptyTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 16,
    color: COLORS.ink,
  },
  emptySubtitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.inkSoft,
    marginTop: 4,
    textAlign: "center",
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
    backgroundColor: COLORS.cream,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
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
  txnIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(59, 51, 48, 0.12)",
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
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: COLORS.ink,
    flexShrink: 1,
  },
  txnMeta: {
    fontFamily: FONTS.body,
    fontSize: 10.5,
    color: COLORS.inkSoft,
    marginTop: 2,
  },
  txnRight: {
    alignItems: "flex-end",
  },
  txnAmount: {
    fontFamily: FONTS.displayBold,
    fontSize: 14.5,
  },
  txnOrigAmount: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.inkSoft,
    marginTop: 1,
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
    backgroundColor: "#F1EEFB",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    padding: 16,
    marginTop: 14,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 3, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  quoteContentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  quoteSparkleEmoji: {
    fontSize: 20,
    marginTop: -2,
  },
  quoteTextCol: {
    flex: 1,
  },
  quoteText: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.ink,
  },
  quoteAuthor: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.inkSoft,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  bottomBarWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 30,
  },
  floatingAddBtn: {
    backgroundColor: COLORS.peach,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    paddingHorizontal: 26,
    gap: 6,
  },
  floatingAddBtnText: {
    fontFamily: FONTS.displayBold,
    fontSize: 16,
    color: COLORS.cream,
    letterSpacing: 0.3,
  },
  bottomTabBar: {
    width: "100%",
    backgroundColor: "rgba(255, 253, 247, 0.96)",
    borderTopWidth: 2,
    borderTopColor: "rgba(59, 51, 48, 0.14)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 10,
    paddingBottom: 4,
    paddingHorizontal: 10,
  },
  bottomTabItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minWidth: 50,
    paddingVertical: 4,
  },
  bottomTabLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  bottomTabLabelActive: {
    fontFamily: FONTS.displayBold,
    color: COLORS.ink,
  },
  bottomTabLabelInactive: {
    fontFamily: FONTS.bodyMedium,
    color: COLORS.inkSoft,
  },
  bottomTabSpacer: {
    width: 64,
  },
  tabScreenHeader: {
    marginBottom: 16,
  },
  tabScreenTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 22,
    color: COLORS.ink,
  },
  tabScreenSubtitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.inkSoft,
    marginTop: 2,
  },
  insightCard: {
    padding: 14,
    borderRadius: 18,
    width: "100%",
  },
  donutSectionCard: {
    padding: 16,
    borderRadius: 24,
    marginBottom: 16,
  },
  donutChartContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  insightHighlightsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    width: "100%",
  },
  insightHighlightCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  insightHighlightEyebrow: {
    fontFamily: FONTS.displayBold,
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: COLORS.inkSoft,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  insightHighlightTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: COLORS.ink,
    textAlign: "center",
  },
  insightHighlightSub: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    color: COLORS.inkSoft,
    marginTop: 2,
    textAlign: "center",
  },
  multiBarContainer: {
    marginTop: 12,
    width: "100%",
  },
  multiBarTrack: {
    height: 10,
    borderRadius: 9999,
    backgroundColor: "#EFE7DA",
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  multiBarHintRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingHorizontal: 2,
  },
  multiBarHintText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10.5,
    color: COLORS.inkSoft,
  },
  resetFilterPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    backgroundColor: COLORS.butter,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
  },
  resetFilterPillText: {
    fontFamily: FONTS.displayBold,
    fontSize: 10,
    color: COLORS.ink,
  },
  listHeaderSubtitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.inkSoft,
  },
  insightDrilldownContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(59, 51, 48, 0.1)",
  },
  drilldownHeader: {
    marginBottom: 6,
  },
  drilldownHeaderText: {
    fontFamily: FONTS.displayBold,
    fontSize: 11,
    color: COLORS.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  insightDrilldownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "#F8F5EE",
    marginBottom: 5,
  },
  insightDrilldownNote: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12.5,
    color: COLORS.ink,
  },
  insightDrilldownDate: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10.5,
    color: COLORS.inkSoft,
    marginTop: 1,
  },
  insightDrilldownAmount: {
    fontFamily: FONTS.displayBold,
    fontSize: 12.5,
    color: "#D35433",
  },
  insightTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  insightLeftRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  insightCatName: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: COLORS.ink,
  },
  insightCatMeta: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.inkSoft,
    marginTop: 1,
  },
  insightAmount: {
    fontFamily: FONTS.displayBold,
    fontSize: 14.5,
    color: "#D35433",
  },
  insightPercentage: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10.5,
    color: COLORS.inkSoft,
    marginTop: 1,
  },
  insightBarTrack: {
    height: 6,
    borderRadius: 9999,
    backgroundColor: "#EFE7DA",
    overflow: "hidden",
    marginTop: 10,
  },
  insightBarFill: {
    height: "100%",
    borderRadius: 9999,
  },
  meSectionHeader: {
    marginTop: 6,
    marginBottom: 8,
  },
  pillTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  pillTagText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.ink,
  },
  sectionEyebrow: {
    fontFamily: FONTS.displayBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: COLORS.inkSoft,
    textTransform: "uppercase",
  },
  settingItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
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
    fontFamily: FONTS.displayBold,
    fontSize: 13.5,
    color: COLORS.ink,
  },
  settingDesc: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.inkSoft,
    marginTop: 1,
  },
  currencySelectPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.paper,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  currencySelectPillText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11.5,
    color: COLORS.ink,
  },
  rowDivider: {
    height: 1,
    backgroundColor: "rgba(59, 51, 48, 0.09)",
    marginVertical: 10,
  },
  toggleSwitchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(59, 51, 48, 0.15)",
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleSwitchTrackActive: {
    backgroundColor: COLORS.mint,
  },
  toggleSwitchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.cream,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
  },
  toggleSwitchThumbActive: {
    transform: [{ translateX: 18 }],
  },
  heroVersionBadge: {
    backgroundColor: COLORS.butter,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  heroVersionText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.ink,
  },
  heroMottoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF8E7",
    borderWidth: 1,
    borderColor: "rgba(217, 119, 6, 0.25)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 12,
  },
  heroMottoText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: "#92400E",
  },
  subPageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  subPageBackButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.cream,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  guaranteeIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#C5EED9",
    borderWidth: 1.2,
    borderColor: "#2D8C65",
    justifyContent: "center",
    alignItems: "center",
  },
  guaranteeTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: "#1F6347",
  },
  guaranteeBody: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11.5,
    color: "#2B5A44",
    marginTop: 2,
    lineHeight: 16,
  },
  updateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.peach,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    paddingVertical: 13,
    paddingHorizontal: 18,
    marginTop: 12,
  },
  updateButtonText: {
    fontFamily: FONTS.displayBold,
    fontSize: 13.5,
    color: COLORS.ink,
  },
  noticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.2,
  },
  noticeBoxSuccess: {
    backgroundColor: "#E6FAF0",
    borderColor: "#2D8C65",
  },
  noticeBoxInfo: {
    backgroundColor: "#F3EEFF",
    borderColor: COLORS.cardBorder,
  },
  noticeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    flex: 1,
  },
  aboutHeadline: {
    fontFamily: FONTS.displayBold,
    fontSize: 15,
    color: COLORS.ink,
    lineHeight: 20,
  },
  aboutBody: {
    fontFamily: FONTS.body,
    fontSize: 12.5,
    color: COLORS.inkSoft,
    marginTop: 6,
    lineHeight: 18,
  },
  aboutFeatureList: {
    gap: 12,
    marginVertical: 4,
  },
  aboutFeatureRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  aboutFeatureIconBox: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  aboutFeatureTextCol: {
    flex: 1,
  },
  aboutFeatureTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 12.5,
    color: COLORS.ink,
  },
  aboutFeatureDesc: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.inkSoft,
    marginTop: 1,
    lineHeight: 15,
  },
  systemInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(59, 51, 48, 0.08)",
  },
  systemLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.inkSoft,
  },
  systemVal: {
    fontFamily: FONTS.displayBold,
    fontSize: 12,
    color: COLORS.ink,
  },
  modalFooter: {
    alignItems: "center",
    paddingVertical: 12,
  },
  footerNoteText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.inkSoft,
  },
  currencySearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cream,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    marginBottom: 8,
  },
  currencySearchInput: {
    flex: 1,
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.ink,
    paddingVertical: 0,
  },
  currencyClearSearchBtn: {
    padding: 4,
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
  emptySearchBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptySearchText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12.5,
    color: COLORS.inkSoft,
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
  resetWarningBanner: {
    backgroundColor: "#FFF5F5",
    borderWidth: 1.5,
    borderColor: "#FEB2B2",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    marginBottom: 14,
    width: "100%",
  },
  resetWarningTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 12,
    color: "#C53030",
    marginBottom: 4,
    textAlign: "center",
  },
  resetWarningText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: "#742A2A",
    lineHeight: 16,
    textAlign: "center",
  },
  resetInputLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.ink,
    marginBottom: 6,
    textAlign: "center",
  },
  resetInputWrapper: {
    backgroundColor: COLORS.paper,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resetTextInput: {
    fontFamily: FONTS.displayBold,
    fontSize: 15,
    color: COLORS.ink,
    textAlign: "center",
    letterSpacing: 1,
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


