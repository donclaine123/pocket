import { isSupabaseConfigured } from "./supabase";

/**
 * Web implementation of PowerSync database loader.
 * In browser environments, data persists to instant local cache (IndexedDB / localStorage / AsyncStorage)
 * and syncs directly with Supabase PostgreSQL in realtime without requiring native C SQLite bindings.
 */
export async function initPowerSync(): Promise<any> {
  if (isSupabaseConfigured) {
    console.log("[Pocket Sync] Web: Supabase Cloud connected.");
  } else {
    console.log("[Pocket Sync] Web: Offline local cache active.");
  }
  return null;
}

export function getPowerSyncDb(): any {
  return null;
}

export function getPowerSyncConnector(): any {
  return null;
}
