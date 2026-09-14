import {
  AbstractPowerSyncDatabase,
  PowerSyncDatabase,
} from "@powersync/react-native";
import { Platform } from "react-native";
import { SupabaseConnector } from "./connector";
import { AppSchema } from "./schema";
import { isSupabaseConfigured } from "./supabase";

let dbInstance: AbstractPowerSyncDatabase | null = null;
let connectorInstance: SupabaseConnector | null = null;
let isInitialized = false;

/**
 * Native iOS/Android PowerSync SQLite loader.
 */
export async function initPowerSync(): Promise<AbstractPowerSyncDatabase | null> {
  if (isInitialized) {
    return dbInstance;
  }

  try {
    dbInstance = new PowerSyncDatabase({
      schema: AppSchema,
      database: {
        dbFilename: "pocket_journal.db",
      },
    });

    connectorInstance = new SupabaseConnector();

    if (isSupabaseConfigured) {
      await dbInstance.connect(connectorInstance);
      console.log("[PowerSync] Connected to cloud synchronization engine.");
    } else {
      console.log("[PowerSync] Local SQLite initialized (Offline / Unconfigured cloud mode).");
    }

    isInitialized = true;
    return dbInstance;
  } catch (err) {
    console.warn("[PowerSync] Native SQLite engine error. Falling back to local cache:", err);
    isInitialized = true;
    return null;
  }
}

export function getPowerSyncDb(): AbstractPowerSyncDatabase | null {
  return dbInstance;
}

export function getPowerSyncConnector(): SupabaseConnector | null {
  return connectorInstance;
}
