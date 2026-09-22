import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { requestWidgetUpdate } from "react-native-android-widget";
import React from "react";
import {
  Balance2x1Widget,
  Glance2x2Widget,
  QuickAdd1x1Widget,
  WidgetDataProps,
} from "../widgets/PocketWidgets";
import { Txn, CategoryKey } from "../types/transaction";
import { toISODate } from "./dateUtils";

export const WIDGET_DATA_STORAGE_KEY = "@pocket_widget_data";
const GUEST_STORAGE_KEY = "@pocket_guest_journal_v2";
const CURRENCY_STORAGE_KEY = "@pocket_currency_pref";

/**
 * Loads current widget summary data from AsyncStorage.
 */
export async function getStoredWidgetData(): Promise<WidgetDataProps> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_DATA_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("[WidgetSync] Could not read cached widget data:", err);
  }

  return {
    currencySymbol: "$",
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
          currencySymbol = parsed?.symbol || "$";
        }
      } catch {}
    }
    if (!currencySymbol) currencySymbol = "$";

    const todayStr = toISODate(new Date());

    let totalBalance = 0;
    let todaySpent = 0;

    for (const t of txns) {
      if (t.type === "income") {
        totalBalance += t.amount;
      } else {
        totalBalance -= t.amount;
        if (t.date.startsWith(todayStr)) {
          todaySpent += t.amount;
        }
      }
    }

    const recentTxns = txns.slice(0, 3).map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      category: t.category,
      note: t.note || "",
    }));

    const widgetData: WidgetDataProps = {
      currencySymbol,
      totalBalance,
      todaySpent,
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
        widgetName: "Glance2x2",
        renderWidget: () => React.createElement(Glance2x2Widget, widgetData),
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
  let currencySymbol = "$";
  try {
    const rawCurr = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);
    if (rawCurr) {
      const parsed = JSON.parse(rawCurr);
      currencySymbol = parsed?.symbol || "$";
    }
  } catch {}

  const todayStr = toISODate(new Date());
  let totalBalance = 0;
  let todaySpent = 0;

  for (const t of updatedTxns) {
    if (t.type === "income") {
      totalBalance += t.amount;
    } else {
      totalBalance -= t.amount;
      if (t.date.startsWith(todayStr)) {
        todaySpent += t.amount;
      }
    }
  }

  const recentTxns = updatedTxns.slice(0, 3).map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    category: t.category,
    note: t.note || "",
  }));

  const widgetData: WidgetDataProps = {
    currencySymbol,
    totalBalance,
    todaySpent,
    recentTxns,
  };

  await AsyncStorage.setItem(
    WIDGET_DATA_STORAGE_KEY,
    JSON.stringify(widgetData)
  );

  return widgetData;
}
