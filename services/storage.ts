import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPowerSyncDb, initPowerSync } from "../database/powersync";
import { isSupabaseConfigured, supabase } from "../database/supabase";
import { SEED_DATA, Txn } from "../types/transaction";
import { CurrencyOption, CURRENCIES, DEFAULT_CURRENCY } from "../constants/currencies";
import { updateAllWidgetsFromTxns } from "./widgetSync";
import { getTxnTimestamp } from "./dateUtils";
import {
  getActiveUserId,
  setActiveUserId,
  addPendingUpserts,
  addPendingDelete,
  getPendingUpserts,
  getPendingDeletes,
  syncPendingTransactions,
} from "./syncQueue";

// Re-export syncQueue primitives so existing callers can import directly from storage
export {
  getActiveUserId,
  setActiveUserId,
  addPendingUpserts,
  addPendingDelete,
  getPendingUpserts,
  getPendingDeletes,
  syncPendingTransactions,
};

export const GUEST_STORAGE_KEY = "@pocket_guest_journal_v2";
const CURRENCY_STORAGE_KEY = "@pocket_currency_pref";

export type SyncState = "synced" | "syncing" | "offline" | "guest";

export function getStorageKey(userId: string | null): string {
  return userId ? `@pocket_user_${userId}` : GUEST_STORAGE_KEY;
}

/**
 * Automatically syncs & merges guest transactions into the signed-in user account:
 * 1. Reads local guest transactions from GUEST_STORAGE_KEY.
 * 2. Merges with the user's existing transactions.
 * 3. Saves and queues merged transactions for Supabase Cloud sync.
 * 4. Cleans up GUEST_STORAGE_KEY so guest data isn't duplicated on future logins.
 */
export async function syncGuestTransactionsToAccount(userId: string): Promise<void> {
  try {
    const rawGuest = await AsyncStorage.getItem(GUEST_STORAGE_KEY);
    if (!rawGuest) return;

    const guestTxns: Txn[] = JSON.parse(rawGuest);
    if (!Array.isArray(guestTxns) || guestTxns.length === 0) {
      return;
    }

    // Retrieve existing user transactions from local cache or cloud
    let userTxns: Txn[] = [];
    const rawUser = await AsyncStorage.getItem(getStorageKey(userId));
    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser);
        if (Array.isArray(parsed)) userTxns = parsed;
      } catch {}
    }

    if (userTxns.length === 0 && isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from("transactions")
          .select("id, type, amount, category, note, date, created_at")
          .eq("user_id", userId);
        if (data) {
          userTxns = data.map((r: any) => ({
            id: r.id,
            type: r.type,
            amount: Number(r.amount),
            category: r.category,
            note: r.note || "",
            date: r.date,
            createdAt: r.created_at,
          }));
        }
      } catch {}
    }

    // Deduplicate by transaction id
    const existingIds = new Set(userTxns.map((t) => t.id));
    const newFromGuest = guestTxns.filter((t) => !existingIds.has(t.id));

    if (newFromGuest.length > 0) {
      const merged = [...newFromGuest, ...userTxns].sort((a, b) => {
        const dateDiff = b.date.localeCompare(a.date);
        if (dateDiff !== 0) return dateDiff;
        return getTxnTimestamp(b) - getTxnTimestamp(a);
      });
      await saveTransactions(merged);
    }

    // Clear guest storage now that transactions are safely migrated to the user account
    await AsyncStorage.removeItem(GUEST_STORAGE_KEY);
  } catch (err) {
    console.error("[Storage] Error syncing guest transactions to account:", err);
  }
}

/**
 * Loads transactions in an Offline-First architecture:
 * 1. Reads local cache first (instant 0ms response).
 * 2. If signed in to cloud and online:
 *    a. Flushes any offline pending writes to Supabase.
 *    b. Fetches remote transactions.
 *    c. Reconciles: NEVER deletes or drops offline transactions that haven't reached the cloud.
 *    d. Merges and queues any missing local entries for upload.
 *    e. Saves reconciled list locally and updates widgets.
 * 3. If offline:
 *    Returns local transactions completely intact without loss.
 */
export async function loadTransactions(): Promise<Txn[]> {
  try {
    const userId = await getActiveUserId();
    const key = getStorageKey(userId);

    // 1. Read local AsyncStorage cache first
    let localTxns: Txn[] = [];
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localTxns = parsed;
      }
    } catch {}

    // In guest mode (or if user key is empty on fresh device), check guest storage
    if (localTxns.length === 0) {
      try {
        const rawGuest = await AsyncStorage.getItem(GUEST_STORAGE_KEY);
        if (rawGuest) {
          const parsed = JSON.parse(rawGuest);
          if (Array.isArray(parsed)) localTxns = parsed;
        }
      } catch {}
    }

    // In guest mode, also inspect prior user caches if present
    if (!userId && localTxns.length === 0) {
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const userKeys = allKeys.filter((k) => k.startsWith("@pocket_user_"));
        for (let i = userKeys.length - 1; i >= 0; i--) {
          const uRaw = await AsyncStorage.getItem(userKeys[i]);
          if (uRaw) {
            const parsed = JSON.parse(uRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              localTxns = parsed;
              break;
            }
          }
        }
      } catch {}
    }

    // 2. Direct Supabase Cloud Reconciliation if signed in
    if (userId && isSupabaseConfigured) {
      // Step A: Attempt to flush any offline pending writes/deletes first
      await syncPendingTransactions().catch(() => {});

      // Step B: Query remote Supabase
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("id, type, amount, category, note, date, created_at")
          .eq("user_id", userId)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });

        if (!error && data) {
          const remoteTxns: Txn[] = data.map((r: any) => ({
            id: r.id,
            type: r.type,
            amount: Number(r.amount),
            category: r.category,
            note: r.note || "",
            date: r.date,
            createdAt: r.created_at || r.createdAt,
          }));

          const pendingDeletes = new Set(await getPendingDeletes(userId));
          const pendingUpserts = await getPendingUpserts(userId);

          // Build reconciled map starting with remote rows (excluding pending deletes)
          const reconciledMap = new Map<string, Txn>();
          for (const rt of remoteTxns) {
            if (!pendingDeletes.has(rt.id)) {
              reconciledMap.set(rt.id, rt);
            }
          }

          // Merge local transactions that were added offline and have not yet reached Supabase
          const unsyncedLocalTxns: Txn[] = [];
          for (const lt of localTxns) {
            if (pendingDeletes.has(lt.id)) continue;

            if (!reconciledMap.has(lt.id)) {
              // Local entry NOT in Supabase! Preserve it and queue for upload!
              reconciledMap.set(lt.id, lt);
              unsyncedLocalTxns.push(lt);
            } else if (pendingUpserts[lt.id]) {
              // Local pending edit takes precedence over remote
              reconciledMap.set(lt.id, pendingUpserts[lt.id]);
            }
          }

          // If there were offline transactions that weren't uploaded, queue them now
          if (unsyncedLocalTxns.length > 0) {
            await addPendingUpserts(userId, unsyncedLocalTxns);
            syncPendingTransactions().catch(() => {});
          }

          const reconciledList = Array.from(reconciledMap.values()).sort((a, b) => {
            const dateDiff = b.date.localeCompare(a.date);
            if (dateDiff !== 0) return dateDiff;
            return getTxnTimestamp(b) - getTxnTimestamp(a);
          });

          // Cache in user key and guest mirror
          await AsyncStorage.setItem(key, JSON.stringify(reconciledList));
          await AsyncStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(reconciledList));

          // Keep widgets updated
          const activeCurrency = await loadSavedCurrency();
          updateAllWidgetsFromTxns(reconciledList, activeCurrency.symbol);

          return reconciledList;
        }
      } catch (err) {
        console.warn("[Storage] Cloud fetch failed, continuing with local offline cache:", err);
      }
    }

    // 3. Fallback: Return verified local cache
    return localTxns;
  } catch (error) {
    console.error("[Storage] Error loading transactions:", error);
    return [];
  }
}

/**
 * Loads transactions filtered by date range [startDate, endDate] (inclusive).
 * Uses reconciled offline-first storage so offline entries are never excluded.
 */
export async function loadTransactionsForPeriod(
  startDate: string,
  endDate: string
): Promise<Txn[]> {
  try {
    const all = await loadTransactions();
    return all.filter((t) => t.date >= startDate && t.date <= endDate);
  } catch (error) {
    console.error("[Storage] Error loading transactions for period:", error);
    return [];
  }
}

/**
 * Saves transactions locally with 0ms UI delay and queues for cloud sync.
 * Works seamlessly offline: writes to local disk, queues pending changes,
 * and updates widgets immediately.
 */
export async function saveTransactions(txns: Txn[]): Promise<void> {
  try {
    const userId = await getActiveUserId();
    const key = getStorageKey(userId);

    // 1. Instant local persistence in user-scoped key and mirror to guest storage
    await AsyncStorage.setItem(key, JSON.stringify(txns));
    await AsyncStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(txns));

    // 2. PowerSync SQLite persistence (if active)
    const db = getPowerSyncDb();
    if (db) {
      await db.writeTransaction(async (tx: any) => {
        for (const t of txns) {
          await tx.execute(
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
              t.id,
              t.type,
              t.amount,
              t.category,
              t.note,
              t.date,
              t.createdAt || new Date().toISOString(),
              new Date().toISOString(),
            ]
          );
        }
      });
    }

    // 3. Queue for cloud sync if signed in
    if (userId && isSupabaseConfigured) {
      await addPendingUpserts(userId, txns);
      // Trigger background sync (non-blocking)
      syncPendingTransactions().catch(() => {});
    }

    // 4. Keep home screen widgets updated in real time
    const activeCurrency = await loadSavedCurrency();
    updateAllWidgetsFromTxns(txns, activeCurrency.symbol);
  } catch (error) {
    console.error("[Storage] Error saving transactions:", error);
  }
}

/**
 * Deletes a single transaction by ID:
 * 1. Removes from local storage cache (guest and user key).
 * 2. Queues ID for cloud deletion.
 * 3. Immediately triggers background cloud sync.
 */
export async function deleteTransaction(id: string): Promise<void> {
  try {
    const userId = await getActiveUserId();
    const key = getStorageKey(userId);

    // 1. Remove from local AsyncStorage cache & mirror to guest storage
    let remainingTxns: Txn[] = [];
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        remainingTxns = parsed.filter((t: any) => t.id !== id);
        await AsyncStorage.setItem(key, JSON.stringify(remainingTxns));
        await AsyncStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(remainingTxns));
      }
    }

    // 2. Remove from PowerSync SQLite database (if active)
    const db = getPowerSyncDb();
    if (db) {
      await db.execute("DELETE FROM transactions WHERE id = ?", [id]);
    }

    // 3. Queue deletion for Supabase Cloud and trigger sync
    if (userId && isSupabaseConfigured) {
      await addPendingDelete(userId, id);
      syncPendingTransactions().catch(() => {});
    }

    // 4. Update home screen widgets
    const activeCurrency = await loadSavedCurrency();
    updateAllWidgetsFromTxns(remainingTxns, activeCurrency.symbol);
  } catch (error) {
    console.error("[Storage] Error deleting transaction:", error);
  }
}

/**
 * Clears transactions for the current active mode (guest or user).
 */
export async function clearTransactions(): Promise<void> {
  try {
    const userId = await getActiveUserId();
    const key = getStorageKey(userId);
    await AsyncStorage.removeItem(key);
    await AsyncStorage.removeItem(GUEST_STORAGE_KEY);

    const db = getPowerSyncDb();
    if (db) {
      await db.execute("DELETE FROM transactions");
    }

    if (userId && isSupabaseConfigured) {
      await supabase.from("transactions").delete().eq("user_id", userId);
    }

    const activeCurrency = await loadSavedCurrency();
    updateAllWidgetsFromTxns([], activeCurrency.symbol);
  } catch (error) {
    console.error("[Storage] Error clearing transactions:", error);
  }
}

/**
 * Helper to get current sync status
 */
export async function getSyncStatus(): Promise<SyncState> {
  if (!isSupabaseConfigured) {
    return "guest";
  }

  const userId = await getActiveUserId();
  if (!userId) {
    return "guest";
  }

  const pendingUpserts = await getPendingUpserts(userId);
  const pendingDeletes = await getPendingDeletes(userId);

  if (Object.keys(pendingUpserts).length > 0 || pendingDeletes.length > 0) {
    return "syncing";
  }

  return "synced";
}

/**
 * Loads the user's preferred currency from AsyncStorage.
 */
export async function loadSavedCurrency(): Promise<CurrencyOption> {
  try {
    const raw = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);
    if (!raw) {
      await AsyncStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(DEFAULT_CURRENCY));
      return DEFAULT_CURRENCY;
    }
    const parsed = JSON.parse(raw);
    const found = CURRENCIES.find((c) => c.code === parsed.code);
    return found || parsed || DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

/**
 * Saves the user's preferred currency to AsyncStorage.
 */
export async function saveSavedCurrency(currency: CurrencyOption): Promise<void> {
  try {
    await AsyncStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(currency));
    const txns = await loadTransactions();
    await updateAllWidgetsFromTxns(txns, currency.symbol);
  } catch (err) {
    console.warn("[Storage] Error saving currency preference:", err);
  }
}
