# Nostr Profile Indexing Server - Development Instructions

## Project Overview
You are building a Nostr profile indexing server that discovers and curates user profiles from Nostr relays. The server will provide filtered profile IDs to a Flutter mobile app, which will then fetch the actual profile data directly from Nostr relays.

## Architecture
- **Runtime**: Deno with Oak framework
- **Database**: Supabase (PostgreSQL)
- **Purpose**: Index Nostr profiles and serve curated lists of profile IDs

## Step 1: Initialize Project Structure
Create the following structure:
```
nostr-indexer-server/
├── main.ts
├── deno.json
├── routes/
│   ├── profiles.ts
│   └── health.ts
├── services/
│   ├── supabase.ts
│   ├── nostr-indexer.ts
│   └── curator.ts
├── models/
│   └── types.ts
├── middleware/
│   ├── cors.ts
│   └── rate-limit.ts
└── config/
    └── env.ts
```

Create deno.json:
```json
{
  "tasks": {
    "dev": "deno run --allow-net --allow-env --watch main.ts",
    "start": "deno run --allow-net --allow-env main.ts"
  },
  "imports": {
    "oak": "https://deno.land/x/oak@v12.6.1/mod.ts",
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.39.3",
    "nostr-tools": "https://esm.sh/nostr-tools@2.1.5"
  }
}
```

## Step 2: Environment Configuration
Create `/config/env.ts`:
```typescript
export const config = {
  port: parseInt(Deno.env.get("PORT") || "8000"),
  supabaseUrl: Deno.env.get("SUPABASE_URL") || "",
  supabaseAnonKey: Deno.env.get("SUPABASE_ANON_KEY") || "",
  nostrRelays: (Deno.env.get("NOSTR_RELAYS") || "wss://relay.damus.io,wss://nos.lol").split(","),
};

// Validate required env vars
if (!config.supabaseUrl || !config.supabaseAnonKey) {
  throw new Error("Missing required environment variables");
}
```

## Step 3: Database Models and Types
Create `/models/types.ts`:
```typescript
export interface Profile {
  pubkey: string;
  has_picture: boolean;
  has_username: boolean;
  has_bio: boolean;
  score: number;
  relay_list: string[];
  last_seen: Date;
  created_at: Date;
}

export interface UserSession {
  session_id: string;
  seen_profiles: string[];
  created_at: Date;
  last_active: Date;
}

export interface ProfileBatchResponse {
  profiles: {
    pubkey: string;
    relays: string[];
    score: number;
    last_updated: string;
  }[];
  next_cursor?: string;
}
```

## Step 4: Supabase Service
Create `/services/supabase.ts`:
```typescript
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
```

## Step 5: Nostr Indexer Service
Create `/services/nostr-indexer.ts`:
```typescript
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
```

## Step 6: Profile Curator Service
Create `/services/curator.ts`:
```typescript
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
        last_updated: p.last_seen.toISOString(),
      })),
    };
  }
}

export const curator = new ProfileCurator();
```

## Step 7: API Routes
Create `/routes/profiles.ts`:
```typescript
import { Router } from "oak";
import { curator } from "../services/curator.ts";

export const profilesRouter = new Router();

profilesRouter.get("/api/profiles/batch", async (ctx) => {
  try {
    const params = ctx.request.url.searchParams;
    const count = parseInt(params.get("count") || "50");
    const excludeIds = params.get("exclude")?.split(",").filter(Boolean) || [];
    const sessionId = params.get("session_id") || undefined;

    const batch = await curator.getCuratedBatch(count, excludeIds, sessionId);
    
    ctx.response.body = batch;
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

profilesRouter.post("/api/profiles/interaction", async (ctx) => {
  try {
    const body = await ctx.request.body().value;
    // Log interaction for future improvements
    console.log("User interaction:", body);
    
    ctx.response.body = { success: true };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});
```

Create `/routes/health.ts`:
```typescript
import { Router } from "oak";

export const healthRouter = new Router();

healthRouter.get("/api/health", (ctx) => {
  ctx.response.body = { 
    status: "ok", 
    timestamp: new Date().toISOString() 
  };
});
```

## Step 8: Middleware
Create `/middleware/cors.ts`:
```typescript
import { Middleware } from "oak";

export const corsMiddleware: Middleware = async (ctx, next) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204;
    return;
  }
  
  await next();
};
```

Create `/middleware/rate-limit.ts`:
```typescript
import { Middleware } from "oak";

const requests = new Map<string, number[]>();
const WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS = 100;

export const rateLimitMiddleware: Middleware = async (ctx, next) => {
  const ip = ctx.request.ip;
  const now = Date.now();
  
  const userRequests = requests.get(ip) || [];
  const recentRequests = userRequests.filter(time => now - time < WINDOW_MS);
  
  if (recentRequests.length >= MAX_REQUESTS) {
    ctx.response.status = 429;
    ctx.response.body = { error: "Too many requests" };
    return;
  }
  
  recentRequests.push(now);
  requests.set(ip, recentRequests);
  
  await next();
};
```

## Step 9: Main Server Entry Point
Create `main.ts`:
```typescript
import { Application } from "oak";
import { config } from "./config/env.ts";
import { profilesRouter } from "./routes/profiles.ts";
import { healthRouter } from "./routes/health.ts";
import { corsMiddleware } from "./middleware/cors.ts";
import { rateLimitMiddleware } from "./middleware/rate-limit.ts";
import { NostrIndexer } from "./services/nostr-indexer.ts";

const app = new Application();

// Middleware
app.use(corsMiddleware);
app.use(rateLimitMiddleware);

// Routes
app.use(profilesRouter.routes());
app.use(profilesRouter.allowedMethods());
app.use(healthRouter.routes());
app.use(healthRouter.allowedMethods());

// Start indexer
const indexer = new NostrIndexer();
indexer.start().catch(console.error);

// Start server
console.log(`Server running on port ${config.port}`);
await app.listen({ port: config.port });
```

## Step 10: Testing
Create a test file to verify your endpoints:
```typescript
// test-api.ts
const baseUrl = "http://localhost:8000";

// Test health endpoint
const health = await fetch(`${baseUrl}/api/health`);
console.log("Health:", await health.json());

// Test profile batch
const batch = await fetch(`${baseUrl}/api/profiles/batch?count=10`);
console.log("Batch:", await batch.json());
```

## Development Workflow
1. Set environment variables in `.env` file (will be provided)
2. Run the server: `deno task dev`
3. Monitor logs to ensure indexer is finding profiles
4. Test endpoints with the test script

## Important Notes
- The indexer runs continuously in the background
- Profiles are scored based on completeness (picture + username + bio)
- The API returns profile IDs and relay hints, not full profile data
- Rate limiting is set to 100 requests per minute per IP
- CORS is configured to accept requests from any origin (for development)