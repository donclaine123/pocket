import { isSupabaseConfigured } from "./supabase";

/**
 * Native Android/iOS safe loader.
 * Uses local fast storage (AsyncStorage) and direct Supabase PostgreSQL sync.
 */
export async function initPowerSync(): Promise<any> {
  return null;
}

export function getPowerSyncDb(): any {
  return null;
}

export function getPowerSyncConnector(): any {
  return null;
}
