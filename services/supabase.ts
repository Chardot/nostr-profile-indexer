import { createClient } from "@supabase/supabase-js";
import { config } from "../config/env.ts";
import type { Profile, UserSession } from "../models/types.ts";

const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

export class DatabaseService {
  async upsertProfile(profile: Partial<Profile>): Promise<void> {
    const { error } = await supabase
      .from("profiles")
      .upsert(profile, { onConflict: "pubkey" });
    
    if (error) throw error;
  }

  async getProfileBatch(
    count: number,
    excludeIds: string[],
    sessionId?: string
  ): Promise<Profile[]> {
    let query = supabase
      .from("profiles")
      .select("*")
      .eq("has_picture", true)
      .eq("has_username", true)
      .eq("has_bio", true)
      .order("score", { ascending: false })
      .limit(count);

    if (excludeIds.length > 0) {
      query = query.not("pubkey", "in", `(${excludeIds.join(",")})`);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    // Update session if provided
    if (sessionId && data) {
      await this.updateSession(sessionId, data.map(p => p.pubkey));
    }

    return data || [];
  }

  async updateSession(sessionId: string, newProfileIds: string[]): Promise<void> {
    // Implementation for session tracking
  }
}

export const db = new DatabaseService();