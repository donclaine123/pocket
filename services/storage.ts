import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPowerSyncDb, initPowerSync } from "../database/powersync";
import { isSupabaseConfigured, supabase } from "../database/supabase";
import { SEED_DATA, Txn } from "../types/transaction";
import { CurrencyOption, CURRENCIES, DEFAULT_CURRENCY } from "../constants/currencies";
import { updateAllWidgetsFromTxns } from "./widgetSync";

const GUEST_STORAGE_KEY = "@pocket_guest_journal_v2";
const CURRENCY_STORAGE_KEY = "@pocket_currency_pref";

export type SyncState = "synced" | "syncing" | "offline" | "guest";

async function getActiveUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

function getStorageKey(userId: string | null): string {
  return userId ? `@pocket_user_${userId}` : GUEST_STORAGE_KEY;
}

/**
 * Automatically syncs & merges guest transactions into the signed-in user account:
 * 1. Reads local guest transactions from GUEST_STORAGE_KEY.
 * 2. If guest transactions exist, merges them with the user's existing transactions.
 * 3. Saves and uploads the merged transactions to Supabase Cloud & user storage.
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

    // Retrieve existing user transactions
    let userTxns: Txn[] = [];
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from("transactions")
          .select("id, type, amount, category, note, date")
          .eq("user_id", userId);
        if (data) {
          userTxns = data.map((r: any) => ({
            id: r.id,
            type: r.type,
            amount: Number(r.amount),
            category: r.category,
            note: r.note || "",
            date: r.date,
          }));
        }
      } catch {}
    }

    if (userTxns.length === 0) {
      const rawUser = await AsyncStorage.getItem(getStorageKey(userId));
      if (rawUser) {
        try {
          const parsed = JSON.parse(rawUser);
          if (Array.isArray(parsed)) userTxns = parsed;
        } catch {}
      }
    }

    // Deduplicate by transaction id
    const existingIds = new Set(userTxns.map((t) => t.id));
    const newFromGuest = guestTxns.filter((t) => !existingIds.has(t.id));

    if (newFromGuest.length > 0) {
      const merged = [...newFromGuest, ...userTxns].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      await saveTransactions(merged);
    }

    // Clear guest storage now that transactions are safely migrated to the new account
    await AsyncStorage.removeItem(GUEST_STORAGE_KEY);
  } catch (err) {
    console.error("[Storage] Error syncing guest transactions to account:", err);
  }
}

/**
 * Loads transactions:
 * 1. If signed in, queries Supabase Cloud directly. The logged-in account's history takes over.
 * 2. Checks local SQLite database via PowerSync if available.
 * 3. Falls back to user-scoped local AsyncStorage cache.
 * 4. In guest mode (signed out), displays preserved local history.
 */
export async function loadTransactions(): Promise<Txn[]> {
  try {
    const userId = await getActiveUserId();

    // 1. Direct Supabase fetch if signed in (account history takes over)
    if (userId && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("id, type, amount, category, note, date")
          .eq("user_id", userId)
          .order("date", { ascending: false });

        if (!error && data) {
          const userTxns: Txn[] = data.map((r: any) => ({
            id: r.id,
            type: r.type,
            amount: Number(r.amount),
            category: r.category,
            note: r.note || "",
            date: r.date,
          }));

          // Cache in user-specific key & mirror to guest key so history is preserved on sign-out
          await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(userTxns));
          await AsyncStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(userTxns));
          return userTxns;
        }
      } catch (err) {
        console.warn("[Storage] Could not fetch directly from Supabase, falling back to cache:", err);
      }
    }

    // 2. Read local AsyncStorage cache first (preserves widget entries and offline guest data)
    const key = getStorageKey(userId);
    let cachedTxns: Txn[] = [];
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) cachedTxns = parsed;
      }
    } catch {}

    // In guest mode, if current key is empty, check other user caches
    if (!userId && cachedTxns.length === 0) {
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const userKeys = allKeys.filter((k) => k.startsWith("@pocket_user_"));
        for (let i = userKeys.length - 1; i >= 0; i--) {
          const uRaw = await AsyncStorage.getItem(userKeys[i]);
          if (uRaw) {
            const parsed = JSON.parse(uRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              cachedTxns = parsed;
              break;
            }
          }
        }
      } catch {}
    }

    // 3. Checks local SQLite database via PowerSync if available
    let sqliteTxns: Txn[] = [];
    try {
      const db = await initPowerSync();
      if (db) {
        const rows = await db.getAll(
          "SELECT id, type, amount, category, note, date FROM transactions ORDER BY date DESC, created_at DESC"
        );
        if (rows && rows.length > 0) {
          sqliteTxns = rows.map((r: any) => ({
            id: r.id,
            type: r.type,
            amount: Number(r.amount),
            category: r.category,
            note: r.note || "",
            date: r.date,
          }));
        }
      }
    } catch {}

    // 4. Merge cached transactions and SQLite transactions (never overwrite or lose widget entries!)
    if (cachedTxns.length > 0 || sqliteTxns.length > 0) {
      const txnMap = new Map<string, Txn>();
      // Insert SQLite transactions first
      for (const t of sqliteTxns) txnMap.set(t.id, t);
      // Let cached transactions take precedence and add new items (including widget entries)
      for (const t of cachedTxns) txnMap.set(t.id, t);

      const merged = Array.from(txnMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      // Keep storage in sync
      await AsyncStorage.setItem(key, JSON.stringify(merged));
      return merged;
    }

    return [];
  } catch (error) {
    console.error("[Storage] Error loading transactions:", error);
    return [];
  }
}

/**
 * Loads transactions filtered by date range [startDate, endDate] (inclusive).
 * Highly optimized for 100,000+ rows using B-Tree composite indexes:
 * - Direct index query in SQLite and Supabase PostgreSQL.
 * - Filters in memory for local cache fallback.
 */
export async function loadTransactionsForPeriod(
  startDate: string,
  endDate: string
): Promise<Txn[]> {
  try {
    const userId = await getActiveUserId();

    // 1. Direct Supabase range fetch if signed in
    if (userId && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("id, type, amount, category, note, date")
          .eq("user_id", userId)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: false });

        if (!error && data) {
          return data.map((r: any) => ({
            id: r.id,
            type: r.type,
            amount: Number(r.amount),
            category: r.category,
            note: r.note || "",
            date: r.date,
          }));
        }
      } catch (err) {
        console.warn("[Storage] Period fetch from Supabase fallback:", err);
      }
    }

    // 2. PowerSync SQLite range query
    const db = await initPowerSync();
    if (db) {
      const rows = await db.getAll(
        "SELECT id, type, amount, category, note, date FROM transactions WHERE date >= ? AND date <= ? ORDER BY date DESC, created_at DESC",
        [startDate, endDate]
      );
      if (rows && rows.length > 0) {
        return rows.map((r: any) => ({
          id: r.id,
          type: r.type,
          amount: Number(r.amount),
          category: r.category,
          note: r.note || "",
          date: r.date,
        }));
      }
    }

    // 3. Fallback: filter user-scoped local cache
    const key = getStorageKey(userId);
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed: Txn[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((t) => t.date >= startDate && t.date <= endDate);
      }
    }
    return [];
  } catch (error) {
    console.error("[Storage] Error loading transactions for period:", error);
    return [];
  }
}

/**
 * Saves transactions locally with 0ms UI delay and queues for cloud sync.
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
            `INSERT INTO transactions (id, type, amount, category, note, date, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               type = excluded.type,
               amount = excluded.amount,
               category = excluded.category,
               note = excluded.note,
               date = excluded.date,
               updated_at = excluded.updated_at`,
            [t.id, t.type, t.amount, t.category, t.note, t.date, new Date().toISOString()]
          );
        }
      });
    }

    // 3. Direct Supabase sync if signed in & configured
    if (userId && isSupabaseConfigured) {
      const rows = txns.map((t) => ({
        id: t.id,
        user_id: userId,
        type: t.type,
        amount: t.amount,
        category: t.category,
        note: t.note,
        date: t.date,
      }));
      await supabase.from("transactions").upsert(rows, { onConflict: "id" });
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
 * 2. Deletes from PowerSync SQLite.
 * 3. Deletes from Supabase Cloud (if signed in).
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

    // 2. Remove from PowerSync SQLite database
    const db = getPowerSyncDb();
    if (db) {
      await db.execute("DELETE FROM transactions WHERE id = ?", [id]);
    }

    // 3. Remove from Supabase Cloud
    if (userId && isSupabaseConfigured) {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) {
        console.error("[Storage] Supabase delete error:", error);
      }
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

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return "guest";
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
      // Persist default currency (PHP ₱) so widgets and background workers read it immediately
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
    // Immediately refresh all widgets with the new currency symbol
    const txns = await loadTransactions();
    await updateAllWidgetsFromTxns(txns, currency.symbol);
  } catch (err) {
    console.warn("[Storage] Error saving currency preference:", err);
  }
}
