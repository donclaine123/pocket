import AsyncStorage from "@react-native-async-storage/async-storage";
import { isSupabaseConfigured, supabase } from "../database/supabase";
import { Txn } from "../types/transaction";

export const ACTIVE_USER_ID_KEY = "@pocket_active_user_id";

function getPendingUpsertsKey(userId: string): string {
  return `@pocket_pending_upserts_${userId}`;
}

function getPendingDeletesKey(userId: string): string {
  return `@pocket_pending_deletes_${userId}`;
}

// Global in-memory cache to prevent disk reads on every query
let inMemoryActiveUserId: string | null = null;
let isInitialized = false;

// Auto-sync listener for Supabase auth state
if (isSupabaseConfigured) {
  try {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.id) {
        inMemoryActiveUserId = session.user.id;
        AsyncStorage.setItem(ACTIVE_USER_ID_KEY, session.user.id).catch(() => {});
      } else if (event === "SIGNED_OUT") {
        inMemoryActiveUserId = null;
        AsyncStorage.removeItem(ACTIVE_USER_ID_KEY).catch(() => {});
      }
    });
  } catch {}
}

/**
 * Returns the active user ID locally with 0ms network dependency.
 * Works 100% reliably even when the device is completely offline.
 */
export async function getActiveUserId(): Promise<string | null> {
  if (inMemoryActiveUserId) {
    return inMemoryActiveUserId;
  }

  // 1. Check local AsyncStorage key
  try {
    const cached = await AsyncStorage.getItem(ACTIVE_USER_ID_KEY);
    if (cached) {
      inMemoryActiveUserId = cached;
      return cached;
    }
  } catch {}

  // 2. Check local Supabase session cache (does NOT make a network call)
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id || null;
      if (userId) {
        inMemoryActiveUserId = userId;
        await AsyncStorage.setItem(ACTIVE_USER_ID_KEY, userId).catch(() => {});
        return userId;
      }
    } catch {}
  }

  return null;
}

/**
 * Updates the active user ID locally (called on sign in or sign out).
 */
export async function setActiveUserId(userId: string | null): Promise<void> {
  inMemoryActiveUserId = userId;
  try {
    if (userId) {
      await AsyncStorage.setItem(ACTIVE_USER_ID_KEY, userId);
    } else {
      await AsyncStorage.removeItem(ACTIVE_USER_ID_KEY);
    }
  } catch (err) {
    console.warn("[SyncQueue] Error setting active user id:", err);
  }
}

/**
 * Retrieves all transactions queued for upsert for the specified user.
 */
export async function getPendingUpserts(userId: string): Promise<Record<string, Txn>> {
  try {
    const raw = await AsyncStorage.getItem(getPendingUpsertsKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch {}
  return {};
}

/**
 * Queues transactions for cloud upsert when offline or pending sync.
 */
export async function addPendingUpserts(userId: string, txns: Txn[]): Promise<void> {
  if (!userId || txns.length === 0) return;
  try {
    const current = await getPendingUpserts(userId);
    for (const t of txns) {
      current[t.id] = t;
    }
    await AsyncStorage.setItem(getPendingUpsertsKey(userId), JSON.stringify(current));

    // Also remove these IDs from pending deletes if they were queued to be deleted
    const pendingDeletes = await getPendingDeletes(userId);
    if (pendingDeletes.length > 0) {
      const addedIds = new Set(txns.map((t) => t.id));
      const remainingDeletes = pendingDeletes.filter((id) => !addedIds.has(id));
      if (remainingDeletes.length !== pendingDeletes.length) {
        await AsyncStorage.setItem(getPendingDeletesKey(userId), JSON.stringify(remainingDeletes));
      }
    }
  } catch (err) {
    console.warn("[SyncQueue] Error adding pending upserts:", err);
  }
}

/**
 * Removes confirmed synced transactions from the pending upsert queue.
 */
export async function removePendingUpserts(userId: string, txnIds: string[]): Promise<void> {
  if (!userId || txnIds.length === 0) return;
  try {
    const current = await getPendingUpserts(userId);
    let changed = false;
    for (const id of txnIds) {
      if (current[id]) {
        delete current[id];
        changed = true;
      }
    }
    if (changed) {
      await AsyncStorage.setItem(getPendingUpsertsKey(userId), JSON.stringify(current));
    }
  } catch (err) {
    console.warn("[SyncQueue] Error removing pending upserts:", err);
  }
}

/**
 * Retrieves all transaction IDs queued for cloud deletion.
 */
export async function getPendingDeletes(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(getPendingDeletesKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Queues a transaction ID for deletion from Supabase cloud.
 */
export async function addPendingDelete(userId: string, txnId: string): Promise<void> {
  if (!userId || !txnId) return;
  try {
    // Remove from pending upserts if it was queued
    await removePendingUpserts(userId, [txnId]);

    const current = await getPendingDeletes(userId);
    if (!current.includes(txnId)) {
      current.push(txnId);
      await AsyncStorage.setItem(getPendingDeletesKey(userId), JSON.stringify(current));
    }
  } catch (err) {
    console.warn("[SyncQueue] Error adding pending delete:", err);
  }
}

/**
 * Removes confirmed deleted transactions from the pending delete queue.
 */
export async function removePendingDeletes(userId: string, txnIds: string[]): Promise<void> {
  if (!userId || txnIds.length === 0) return;
  try {
    const current = await getPendingDeletes(userId);
    const toRemove = new Set(txnIds);
    const updated = current.filter((id) => !toRemove.has(id));
    await AsyncStorage.setItem(getPendingDeletesKey(userId), JSON.stringify(updated));
  } catch (err) {
    console.warn("[SyncQueue] Error removing pending deletes:", err);
  }
}

let isSyncing = false;

/**
 * Flushes all pending deletes and pending upserts to Supabase Cloud.
 * If offline or if an error occurs, items safely remain in the queue.
 */
export async function syncPendingTransactions(): Promise<{ syncedUpserts: number; syncedDeletes: number }> {
  if (!isSupabaseConfigured) return { syncedUpserts: 0, syncedDeletes: 0 };
  const userId = await getActiveUserId();
  if (!userId) return { syncedUpserts: 0, syncedDeletes: 0 };

  if (isSyncing) {
    return { syncedUpserts: 0, syncedDeletes: 0 };
  }

  isSyncing = true;
  let syncedUpserts = 0;
  let syncedDeletes = 0;

  try {
    // 1. Process Pending Deletes first
    const pendingDeletes = await getPendingDeletes(userId);
    if (pendingDeletes.length > 0) {
      // Chunk deletes in batches of 50
      const CHUNK_SIZE = 50;
      for (let i = 0; i < pendingDeletes.length; i += CHUNK_SIZE) {
        const chunk = pendingDeletes.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase
          .from("transactions")
          .delete()
          .in("id", chunk)
          .eq("user_id", userId);

        if (!error) {
          await removePendingDeletes(userId, chunk);
          syncedDeletes += chunk.length;
        } else {
          console.warn("[SyncQueue] Failed to delete chunk from Supabase:", error);
          break; // Stop further requests if offline/network error
        }
      }
    }

    // 2. Process Pending Upserts
    const pendingUpserts = await getPendingUpserts(userId);
    const upsertList = Object.values(pendingUpserts);

    if (upsertList.length > 0) {
      const CHUNK_SIZE = 50;
      for (let i = 0; i < upsertList.length; i += CHUNK_SIZE) {
        const chunk = upsertList.slice(i, i + CHUNK_SIZE);
        const rows = chunk.map((t) => ({
          id: t.id,
          user_id: userId,
          type: t.type,
          amount: t.amount,
          category: t.category,
          note: t.note || "",
          date: t.date,
          created_at: t.createdAt || new Date().toISOString(),
        }));

        const { error } = await supabase
          .from("transactions")
          .upsert(rows, { onConflict: "id" });

        if (!error) {
          await removePendingUpserts(userId, chunk.map((t) => t.id));
          syncedUpserts += chunk.length;
        } else {
          console.warn("[SyncQueue] Failed to upsert chunk to Supabase:", error);
          break; // Stop further requests if offline/network error
        }
      }
    }
  } catch (err) {
    // Device is likely offline - changes are kept safely in AsyncStorage
    console.log("[SyncQueue] Cloud sync deferred (network unreachable):", err);
  } finally {
    isSyncing = false;
  }

  return { syncedUpserts, syncedDeletes };
}
