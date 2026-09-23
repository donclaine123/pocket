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
import { toISODate } from "./dateUtils";
import { DEFAULT_CURRENCY } from "../constants/currencies";
import { isSupabaseConfigured, supabase } from "../database/supabase";
import { getPowerSyncDb } from "../database/powersync";

export const WIDGET_DATA_STORAGE_KEY = "@pocket_widget_data";
const GUEST_STORAGE_KEY = "@pocket_guest_journal_v2";
const CURRENCY_STORAGE_KEY = "@pocket_currency_pref";

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
    if (!currencySymbol) {
      try {
        const rawCurr = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);
        if (rawCurr) {
          const parsed = JSON.parse(rawCurr);
          currencySymbol = parsed?.symbol || DEFAULT_CURRENCY.symbol;
        }
      } catch {}
    }
    if (!currencySymbol) currencySymbol = DEFAULT_CURRENCY.symbol;

    const todayStr = toISODate(new Date());

    let totalBalance = 0;
    let todaySpent = 0;
    let todayIncome = 0;

    for (const t of txns) {
      if (t.type === "income") {
        totalBalance += t.amount;
        if (t.date.startsWith(todayStr)) {
          todayIncome += t.amount;
        }
      } else {
        totalBalance -= t.amount;
        if (t.date.startsWith(todayStr)) {
          todaySpent += t.amount;
        }
      }
    }

    const recentTxns = txns.slice(0, 5).map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      category: t.category,
      note: t.note || "",
      date: t.date,
    }));

    const isDark = Appearance.getColorScheme() === "dark";

    const widgetData: WidgetDataProps = {
      currencySymbol,
      totalBalance,
      todaySpent,
      todayIncome,
      isDark,
      recentTxns,
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
  const newTxn: Txn = {
    id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: "expense",
    amount,
    category: category as CategoryKey,
    note,
    date: toISODate(new Date()),
  };

  // Check if a user is signed in to mirror transaction to their account and Supabase cloud
  let userId: string | null = null;
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.auth.getUser();
      userId = data?.user?.id || null;
    } catch {}
  }

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
          `INSERT INTO transactions (id, type, amount, category, note, date, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             type = excluded.type,
             amount = excluded.amount,
             category = excluded.category,
             note = excluded.note,
             date = excluded.date,
             updated_at = excluded.updated_at`,
          [newTxn.id, newTxn.type, newTxn.amount, newTxn.category, newTxn.note, newTxn.date, new Date().toISOString()]
        );
      }
    } catch {}

    // Upload directly to Supabase cloud if signed in
    if (userId && isSupabaseConfigured) {
      await supabase.from("transactions").upsert([
        {
          id: newTxn.id,
          user_id: userId,
          type: newTxn.type,
          amount: newTxn.amount,
          category: newTxn.category,
          note: newTxn.note,
          date: newTxn.date,
        },
      ], { onConflict: "id" });
    }
  } catch (err) {
    console.warn("[WidgetSync] Error persisting preset txn:", err);
  }

  // Recalculate metrics
  let currencySymbol = DEFAULT_CURRENCY.symbol;
  try {
    const rawCurr = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);
    if (rawCurr) {
      const parsed = JSON.parse(rawCurr);
      currencySymbol = parsed?.symbol || DEFAULT_CURRENCY.symbol;
    }
  } catch {}

  const todayStr = toISODate(new Date());
  let totalBalance = 0;
  let todaySpent = 0;
  let todayIncome = 0;

  for (const t of updatedTxns) {
    if (t.type === "income") {
      totalBalance += t.amount;
      if (t.date.startsWith(todayStr)) {
        todayIncome += t.amount;
      }
    } else {
      totalBalance -= t.amount;
      if (t.date.startsWith(todayStr)) {
        todaySpent += t.amount;
      }
    }
  }

  const recentTxns = updatedTxns.slice(0, 5).map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    category: t.category,
    note: t.note || "",
    date: t.date,
  }));

  const widgetData: WidgetDataProps = {
    currencySymbol,
    totalBalance,
    todaySpent,
    todayIncome,
    recentTxns,
  };

  await AsyncStorage.setItem(
    WIDGET_DATA_STORAGE_KEY,
    JSON.stringify(widgetData)
  );

  return widgetData;
}
