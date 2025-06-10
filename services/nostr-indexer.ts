import { SimplePool, type Event } from "nostr-tools";
import { config } from "../config/env.ts";
import { db } from "./supabase.ts";

export class NostrIndexer {
  private pool: SimplePool;
  private relays: string[];

  constructor() {
    this.pool = new SimplePool();
    this.relays = config.nostrRelays;
  }

  async start(): Promise<void> {
    console.log("Starting Nostr indexer...");
    
    const subscription = this.pool.subscribeMany(
      this.relays,
      [{ kinds: [0], limit: 1000 }],
      {
        onevent: (event: Event) => this.processProfileEvent(event),
        oneose: () => console.log("Initial sync complete"),
      }
    );

    // Keep running
    setInterval(() => {
      console.log("Indexer heartbeat");
    }, 60000);
  }

  private async processProfileEvent(event: Event): Promise<void> {
    try {
      const metadata = JSON.parse(event.content);
      
      // Check if profile has required fields
      const hasPicture = !!(metadata.picture || metadata.image);
      const hasUsername = !!(metadata.name || metadata.username || metadata.display_name);
      const hasBio = !!(metadata.about || metadata.bio);

      // Calculate score (0-1)
      let score = 0;
      if (hasPicture) score += 0.4;
      if (hasUsername) score += 0.3;
      if (hasBio) score += 0.3;

      await db.upsertProfile({
        pubkey: event.pubkey,
        has_picture: hasPicture,
        has_username: hasUsername,
        has_bio: hasBio,
        score,
        relay_list: this.relays,
        last_seen: new Date(),
      });

    } catch (error) {
      console.error("Error processing profile:", error);
    }
  }
}