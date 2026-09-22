import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
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

  try {
    const raw = await AsyncStorage.getItem(WIDGET_DATA_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      data.currencySymbol = currencySymbol;
      return data;
    }
  } catch (err) {
    console.warn("[WidgetSync] Could not read cached widget data:", err);
  }

  return {
    currencySymbol,
    totalBalance: 0,
    todaySpent: 0,
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

    const widgetData: WidgetDataProps = {
      currencySymbol,
      totalBalance,
      todaySpent,
      todayIncome,
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
    date: new Date().toISOString(),
  };

  // Find storage key to update
  let currentTxns: Txn[] = [];
  try {
    const raw = await AsyncStorage.getItem(GUEST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) currentTxns = parsed;
    }
  } catch {}

  const updatedTxns = [newTxn, ...currentTxns];
  try {
    await AsyncStorage.setItem(
      GUEST_STORAGE_KEY,
      JSON.stringify(updatedTxns)
    );
  } catch {}

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
