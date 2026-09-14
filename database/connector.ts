import { isSupabaseConfigured, supabase } from "./supabase";

export class SupabaseConnector {
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

    return {
      endpoint: powerSyncUrl,
      token: session.access_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    };
  }

  async uploadData(database: any): Promise<void> {
    // Handled directly via Supabase API
  }
}
