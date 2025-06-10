import { db } from "./supabase.ts";
import type { ProfileBatchResponse } from "../models/types.ts";

export class ProfileCurator {
  async getCuratedBatch(
    count: number = 50,
    excludeIds: string[] = [],
    sessionId?: string
  ): Promise<ProfileBatchResponse> {
    const profiles = await db.getProfileBatch(count, excludeIds, sessionId);
    
    return {
      profiles: profiles.map(p => ({
        pubkey: p.pubkey,
        relays: p.relay_list,
        score: p.score,
        last_updated: typeof p.last_seen === 'string' ? p.last_seen : p.last_seen.toISOString(),
      })),
    };
  }
}

export const curator = new ProfileCurator();