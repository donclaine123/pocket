import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPowerSyncDb, initPowerSync } from "../database/powersync";
import { isSupabaseConfigured, supabase } from "../database/supabase";
import { SEED_DATA, Txn } from "../types/transaction";
import { CurrencyOption, CURRENCIES, DEFAULT_CURRENCY } from "../constants/currencies";

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
 * Loads transactions:
 * 1. If signed in, queries Supabase Cloud directly.
 * 2. If available, checks local SQLite database via PowerSync.
 * 3. Falls back to user-scoped local AsyncStorage cache.
 * 4. In guest mode, loads only guest transactions (starts empty []).
 */
export async function loadTransactions(): Promise<Txn[]> {
  try {
    const userId = await getActiveUserId();

    // 1. Direct Supabase fetch if signed in
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

          // Cache in user-specific key
          await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(userTxns));
          return userTxns;
        }
      } catch (err) {
        console.warn("[Storage] Could not fetch directly from Supabase, falling back to cache:", err);
      }
    }

    // 2. Checks local SQLite database via PowerSync if available
    const db = await initPowerSync();
    if (db) {
      const rows = await db.getAll(
        "SELECT id, type, amount, category, note, date FROM transactions ORDER BY date DESC, created_at DESC"
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

    // 3. User-scoped local cache fallback
    const key = getStorageKey(userId);
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
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

    // 1. Instant local persistence in user-scoped key
    await AsyncStorage.setItem(key, JSON.stringify(txns));

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
  } catch (error) {
    console.error("[Storage] Error saving transactions:", error);
  }
}

/**
 * Deletes a single transaction by ID:
 * 1. Removes from local storage cache (guest or user key).
 * 2. Deletes from PowerSync SQLite.
 * 3. Deletes from Supabase Cloud (if signed in).
 */
export async function deleteTransaction(id: string): Promise<void> {
  try {
    const userId = await getActiveUserId();
    const key = getStorageKey(userId);

    // 1. Remove from local AsyncStorage cache
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((t: any) => t.id !== id);
        await AsyncStorage.setItem(key, JSON.stringify(filtered));
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

    const db = getPowerSyncDb();
    if (db) {
      await db.execute("DELETE FROM transactions");
    }

    if (userId && isSupabaseConfigured) {
      await supabase.from("transactions").delete().eq("user_id", userId);
    }
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
    if (!raw) return DEFAULT_CURRENCY;
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
  } catch (err) {
    console.warn("[Storage] Error saving currency preference:", err);
  }
}
