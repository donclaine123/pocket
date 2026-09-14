import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  UpdateType,
} from "@powersync/react-native";
import { isSupabaseConfigured, supabase } from "./supabase";

export class SupabaseConnector implements PowerSyncBackendConnector {
  /**
   * Fetches PowerSync connection credentials.
   * Typically in production, you invoke a Supabase Edge Function that verifies
   * your Supabase auth JWT and returns a PowerSync JWT.
   */
  async fetchCredentials() {
    if (!isSupabaseConfigured) {
      return null;
    }

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      return null;
    }

    const powerSyncUrl = process.env.EXPO_PUBLIC_POWERSYNC_URL;
    if (!powerSyncUrl) {
      return null;
    }

    // In a full setup, call your edge function:
    // const res = await supabase.functions.invoke('powersync-auth');
    // return { endpoint: powerSyncUrl, token: res.data.token };

    // Or using custom JWT configured in PowerSync Dashboard:
    return {
      endpoint: powerSyncUrl,
      token: session.access_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    };
  }

  /**
   * Uploads local SQLite mutations to Supabase Postgres.
   * This is triggered automatically by PowerSync whenever the client makes changes offline/online.
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    if (!isSupabaseConfigured) {
      return;
    }

    const batch = await database.getNextCrudTransaction();
    if (!batch) {
      return;
    }

    try {
      for (const op of batch.crud) {
        const table = op.table;
        const id = op.id;

        if (table === "transactions") {
          if (op.op === UpdateType.PUT) {
            // INSERT
            const rowData = { ...op.opData, id };
            const { error } = await supabase.from("transactions").insert(rowData);
            if (error && error.code !== "23505") { // Ignore duplicate key errors
              throw error;
            }
          } else if (op.op === UpdateType.PATCH) {
            // UPDATE
            const updatePayload = op.opData ? { ...op.opData } : {};
            const { error } = await supabase.from("transactions").update(updatePayload).eq("id", id);
            if (error) throw error;
          } else if (op.op === UpdateType.DELETE) {
            // DELETE
            const { error } = await supabase.from("transactions").delete().eq("id", id);
            if (error) throw error;
          }
        }
      }

      await batch.complete();
    } catch (err) {
      console.warn("[PowerSync] Sync upload error, will retry:", err);
      throw err;
    }
  }
}
