import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance, Platform } from "react-native";
import { requestWidgetUpdate } from "react-native-android-widget";
import React from "react";
import {
  Balance2x1Widget,
  Banner4x1Widget,
  Dashboard4x2Widget,
  FullJournal4x4Widget,
  Glance2x2Widget,
  QuickAdd1x1Widget,
  WidgetDataProps,
} from "../widgets/PocketWidgets";
import { Txn, CategoryKey } from "../types/transaction";
import { getAvailableBalance } from "./accounting";
import { toISODate } from "./dateUtils";
import { DEFAULT_CURRENCY } from "../constants/currencies";
import { convertAmount, getCachedRates, loadConversionEnabled } from "./exchangeService";
import {
  getDefaultBudgetGroup,
  getMonthlySalaryBudget,
  loadSalaryAllocation,
  loadSalaryBudgetStartMonth,
  loadEmergencyReserveCorrection,
} from "./salaryBudget";
import { isSupabaseConfigured, supabase } from "../database/supabase";
import { getPowerSyncDb } from "../database/powersync";
import {
  getActiveUserId,
  addPendingUpserts,
  syncPendingTransactions,
} from "./syncQueue";

export const WIDGET_DATA_STORAGE_KEY = "@pocket_widget_data";
const GUEST_STORAGE_KEY = "@pocket_guest_journal_v2";
const CURRENCY_STORAGE_KEY = "@pocket_currency_pref";

async function getWidgetAccounting(txns: Txn[], currencyCode: string) {
  const [plan, startMonth, conversionEnabled, rates, reserveCorrection] = await Promise.all([
    loadSalaryAllocation(),
    loadSalaryBudgetStartMonth(),
    loadConversionEnabled(),
    getCachedRates(),
    loadEmergencyReserveCorrection(currencyCode),
  ]);
  const budgetTxns = conversionEnabled
    ? txns.map((txn) => ({
        ...txn,
        amount: convertAmount(
          txn.amount,
          txn.originalCurrency || DEFAULT_CURRENCY.code,
          currencyCode,
          rates
        ),
      }))
    : txns;
  return {
    txns: budgetTxns,
    totalBalance: getAvailableBalance(budgetTxns, plan, reserveCorrection),
    budgetSummary: getMonthlySalaryBudget(budgetTxns, plan, undefined, startMonth),
  };
}

/**
 * Loads current widget summary data from AsyncStorage.
 */
export async function getStoredWidgetData(): Promise<WidgetDataProps> {
  let currencySymbol = DEFAULT_CURRENCY.symbol;
  try {
    const rawCurr = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);
    if (rawCurr) {
      const parsedCurr = JSON.parse(rawCurr);
      if (parsedCurr?.symbol) currencySymbol = parsedCurr.symbol;
    }
  } catch {}

  const isDark = Appearance.getColorScheme() === "dark";

  try {
    const raw = await AsyncStorage.getItem(WIDGET_DATA_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      data.currencySymbol = currencySymbol;
      data.isDark = isDark;
      return data;
    }
  } catch (err) {
    console.warn("[WidgetSync] Could not read cached widget data:", err);
  }

  return {
    currencySymbol,
    totalBalance: 0,
    todaySpent: 0,
    todayIncome: 0,
    isDark,
    recentTxns: [],
  };
}

/**
 * Computes widget metrics from a transaction list and updates all home screen widgets.
 */
export async function updateAllWidgetsFromTxns(
  txns: Txn[],
  overrideCurrency?: string
): Promise<void> {
  if (Platform.OS !== "android") return;

  try {
    let currencySymbol = overrideCurrency;
    let currencyCode = DEFAULT_CURRENCY.code;
    if (!currencySymbol) {
      try {
        const rawCurr = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);
        if (rawCurr) {
          const parsed = JSON.parse(rawCurr);
          currencySymbol = parsed?.symbol || DEFAULT_CURRENCY.symbol;
          currencyCode = parsed?.code || DEFAULT_CURRENCY.code;
        }
      } catch {}
    } else {
      try {
        const rawCurr = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);
        if (rawCurr) currencyCode = JSON.parse(rawCurr)?.code || DEFAULT_CURRENCY.code;
      } catch {}
    }
    if (!currencySymbol) currencySymbol = DEFAULT_CURRENCY.symbol;

    const todayStr = toISODate(new Date());

    const accounting = await getWidgetAccounting(txns, currencyCode);
    let todaySpent = 0;
    let todayIncome = 0;

    for (const t of accounting.txns) {
      if (t.date.startsWith(todayStr) && t.type === "income") todayIncome += t.amount;
      if (t.date.startsWith(todayStr) && t.type === "expense") todaySpent += t.amount;
    }

    const recentTxns = accounting.txns.slice(0, 5).map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      category: t.category,
      budgetGroup: t.type === "expense" ? t.budgetGroup || getDefaultBudgetGroup(t.category) : undefined,
      note: t.note || "",
      date: t.date,
    }));
    const isDark = Appearance.getColorScheme() === "dark";

    const widgetData: WidgetDataProps = {
      currencySymbol,
      totalBalance: accounting.totalBalance,
      todaySpent,
      todayIncome,
      isDark,
      recentTxns,
      budgetSummary: accounting.budgetSummary,
    };

    // Cache locally for fast subsequent reads
    await AsyncStorage.setItem(
      WIDGET_DATA_STORAGE_KEY,
      JSON.stringify(widgetData)
    );

    // Request native Android widget updates
    await Promise.allSettled([
      requestWidgetUpdate({
        widgetName: "QuickAdd1x1",
        renderWidget: () => React.createElement(QuickAdd1x1Widget, widgetData),
      }),
      requestWidgetUpdate({
        widgetName: "Balance2x1",
        renderWidget: () => React.createElement(Balance2x1Widget, widgetData),
      }),
      requestWidgetUpdate({
        widgetName: "Banner4x1",
        renderWidget: () => React.createElement(Banner4x1Widget, widgetData),
      }),
      requestWidgetUpdate({
        widgetName: "Glance2x2",
        renderWidget: () => React.createElement(Glance2x2Widget, widgetData),
      }),
      requestWidgetUpdate({
        widgetName: "Dashboard4x2",
        renderWidget: () => React.createElement(Dashboard4x2Widget, widgetData),
      }),
      requestWidgetUpdate({
        widgetName: "FullJournal4x4",
        renderWidget: () => React.createElement(FullJournal4x4Widget, widgetData),
      }),
    ]);
  } catch (error) {
    console.warn("[WidgetSync] Error updating widgets:", error);
  }
}

/**
 * Refreshes all widgets using current Appearance theme and cached transaction data.
 */
export async function refreshAllWidgets(forcedIsDark?: boolean): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const widgetData = await getStoredWidgetData();
    const isDark =
      typeof forcedIsDark === "boolean"
        ? forcedIsDark
        : Appearance.getColorScheme() === "dark";
    widgetData.isDark = isDark;

    const userId = await getActiveUserId();
    const rawTransactions =
      (await AsyncStorage.getItem(userId ? `@pocket_user_${userId}` : GUEST_STORAGE_KEY)) ||
      (await AsyncStorage.getItem(GUEST_STORAGE_KEY));
    const rawCurrency = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);
    const currencyCode = rawCurrency
      ? JSON.parse(rawCurrency)?.code || DEFAULT_CURRENCY.code
      : DEFAULT_CURRENCY.code;
    if (rawTransactions) {
      const parsed = JSON.parse(rawTransactions);
      if (Array.isArray(parsed)) {
        const accounting = await getWidgetAccounting(parsed, currencyCode);
        const todayStr = toISODate(new Date());
        widgetData.totalBalance = accounting.totalBalance;
        widgetData.budgetSummary = accounting.budgetSummary;
        widgetData.todayIncome = accounting.txns.reduce(
          (total, txn) => total + (txn.date.startsWith(todayStr) && txn.type === "income" ? txn.amount : 0),
          0
        );
        widgetData.todaySpent = accounting.txns.reduce(
          (total, txn) => total + (txn.date.startsWith(todayStr) && txn.type === "expense" ? txn.amount : 0),
          0
        );
        widgetData.recentTxns = accounting.txns.slice(0, 5).map((txn) => ({
          id: txn.id,
          type: txn.type,
          amount: txn.amount,
          category: txn.category,
          budgetGroup: txn.type === "expense"
            ? txn.budgetGroup || getDefaultBudgetGroup(txn.category)
            : undefined,
          note: txn.note || "",
          date: txn.date,
        }));
      }
    }

    // Cache with updated theme
    await AsyncStorage.setItem(
      WIDGET_DATA_STORAGE_KEY,
      JSON.stringify(widgetData)
    );

    await Promise.allSettled([
      requestWidgetUpdate({
        widgetName: "QuickAdd1x1",
        renderWidget: () => React.createElement(QuickAdd1x1Widget, widgetData),
      }),
      requestWidgetUpdate({
        widgetName: "Balance2x1",
        renderWidget: () => React.createElement(Balance2x1Widget, widgetData),
      }),
      requestWidgetUpdate({
        widgetName: "Banner4x1",
        renderWidget: () => React.createElement(Banner4x1Widget, widgetData),
      }),
      requestWidgetUpdate({
        widgetName: "Glance2x2",
        renderWidget: () => React.createElement(Glance2x2Widget, widgetData),
      }),
      requestWidgetUpdate({
        widgetName: "Dashboard4x2",
        renderWidget: () => React.createElement(Dashboard4x2Widget, widgetData),
      }),
      requestWidgetUpdate({
        widgetName: "FullJournal4x4",
        renderWidget: () => React.createElement(FullJournal4x4Widget, widgetData),
      }),
    ]);
  } catch (err) {
    console.warn("[WidgetSync] Error refreshing widgets:", err);
  }
}

/**
 * Handles background 1-tap preset logging from widget (e.g. +$5 Coffee).
 * Executes in headless background service without launching the app.
 */
export async function logPresetTransactionFromWidget(
  amount: number,
  category: string,
  note: string
): Promise<WidgetDataProps> {
  let currencySymbol = DEFAULT_CURRENCY.symbol;
  let currencyCode = DEFAULT_CURRENCY.code;
  try {
    const rawCurr = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);
    if (rawCurr) {
      const parsed = JSON.parse(rawCurr);
      currencySymbol = parsed?.symbol || currencySymbol;
      currencyCode = parsed?.code || currencyCode;
    }
  } catch {}

  const now = new Date();
  const newTxn: Txn = {
    id: `w_${now.getTime()}_${Math.random().toString(36).slice(2, 7)}`,
    type: "expense",
    amount,
    category: category as CategoryKey,
    note,
    date: toISODate(now),
    createdAt: now.toISOString(),
    originalCurrency: currencyCode,
    budgetGroup: getDefaultBudgetGroup(category as CategoryKey),
  };

  // Check if a user is signed in using offline-first local check
  const userId = await getActiveUserId();

  // Find storage key to update
  const userKey = userId ? `@pocket_user_${userId}` : null;
  let currentTxns: Txn[] = [];
  try {
    const raw = await AsyncStorage.getItem(userKey || GUEST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) currentTxns = parsed;
    }
  } catch {}

  const updatedTxns = [newTxn, ...currentTxns];
  try {
    // Save to user storage if signed in
    if (userKey) {
      await AsyncStorage.setItem(userKey, JSON.stringify(updatedTxns));
    }
    // Also save to guest key as mirror
    await AsyncStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(updatedTxns));

    // Also persist to local SQLite if active
    try {
      const db = getPowerSyncDb();
      if (db) {
        await db.execute(
          `INSERT INTO transactions (id, type, amount, category, note, date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             type = excluded.type,
             amount = excluded.amount,
             category = excluded.category,
             note = excluded.note,
             date = excluded.date,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at`,
          [
            newTxn.id,
            newTxn.type,
            newTxn.amount,
            newTxn.category,
            newTxn.note,
            newTxn.date,
            newTxn.createdAt,
            new Date().toISOString(),
          ]
        );
      }
    } catch {}

    // Queue for cloud sync if signed in
    if (userId && isSupabaseConfigured) {
      await addPendingUpserts(userId, [newTxn]);
      // Trigger background sync (non-blocking)
      syncPendingTransactions().catch(() => {});
    }
  } catch (err) {
    console.warn("[WidgetSync] Error persisting preset txn:", err);
  }

  // Recalculate metrics
  const todayStr = toISODate(new Date());
  const accounting = await getWidgetAccounting(updatedTxns, currencyCode);
  let todaySpent = 0;
  let todayIncome = 0;

  for (const t of accounting.txns) {
    if (t.date.startsWith(todayStr) && t.type === "income") todayIncome += t.amount;
    if (t.date.startsWith(todayStr) && t.type === "expense") todaySpent += t.amount;
  }

  const recentTxns = accounting.txns.slice(0, 5).map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    category: t.category,
    budgetGroup: t.type === "expense" ? t.budgetGroup || getDefaultBudgetGroup(t.category) : undefined,
    note: t.note || "",
    date: t.date,
  }));

  const widgetData: WidgetDataProps = {
    currencySymbol,
    totalBalance: accounting.totalBalance,
    todaySpent,
    todayIncome,
    recentTxns,
    budgetSummary: accounting.budgetSummary,
  };

  await AsyncStorage.setItem(
    WIDGET_DATA_STORAGE_KEY,
    JSON.stringify(widgetData)
  );

  return widgetData;
}
