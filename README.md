# Nostr Profile Indexer

## Abstract

The Nostr Profile Indexer is a server that discovers and organizes user profiles from the Nostr network. Think of it as a librarian that continuously searches through Nostr relays (servers), finds user profiles, evaluates their completeness, and creates a curated catalog. When mobile apps need to show users interesting profiles to follow, they can ask this server for recommendations instead of searching through thousands of profiles themselves.

In simple terms: This server does the heavy lifting of finding good Nostr profiles so your app doesn't have to.

## How It Works

1. **Discovery**: The server connects to popular Nostr relays and listens for user profile updates
2. **Evaluation**: Each profile is scored based on whether it has a picture, username, and bio
3. **Storage**: Profile information is saved in a database with quality scores
4. **Serving**: Apps can request batches of high-quality profile IDs to show to users

## Implementation Details

### Architecture Overview

The server is built with:
- **Runtime**: Deno (a modern JavaScript/TypeScript runtime)
- **Framework**: Oak (similar to Express.js but for Deno)
- **Database**: Supabase (PostgreSQL as a service)
- **Protocol**: Nostr WebSocket connections for real-time profile discovery

### Core Components

#### 1. Nostr Indexer Service (`/services/nostr-indexer.ts`)
- Connects to multiple Nostr relays simultaneously
- Subscribes to profile metadata events (kind 0)
- Processes incoming profiles in real-time
- Calculates quality scores based on profile completeness

#### 2. Database Service (`/services/supabase.ts`)
- Manages profile storage and retrieval
- Handles upsert operations to keep profiles updated
- Filters profiles by quality criteria
- Tracks which profiles users have already seen

#### 3. Profile Curator (`/services/curator.ts`)
- Provides the main API logic for serving profile batches
- Returns only profile IDs and relay hints (not full data)
- Supports pagination and session tracking

#### 4. API Endpoints

- `GET /api/profiles/batch` - Retrieve curated profile IDs
  - Query params: `count`, `exclude` (comma-separated IDs), `session_id`
  - Returns: Array of profile IDs with relay hints and scores
  
- `POST /api/profiles/interaction` - Log user interactions with profiles
  - Used for improving recommendations (future feature)
  
- `GET /api/health` - Server health check
  - Returns: Server status and timestamp

#### 5. Middleware

- **CORS**: Allows requests from any origin (configurable for production)
- **Rate Limiting**: 100 requests per minute per IP address

### Database Schema

```typescript
Profile {
  pubkey: string          // Nostr public key (unique identifier)
  has_picture: boolean    // Profile has avatar image
  has_username: boolean   // Profile has display name
  has_bio: boolean        // Profile has description
  score: number          // Quality score (0-1)
  relay_list: string[]   // Where this profile was found
  last_seen: Date        // Last update timestamp
  created_at: Date       // First seen timestamp
}
```

### Scoring Algorithm

Profiles are scored on a 0-1 scale:
- Has picture: +0.4 points
- Has username: +0.3 points  
- Has bio: +0.3 points

Only profiles with all three attributes (score = 1.0) are served by default.

### Running the Server

1. Set environment variables:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol
PORT=8000
```

2. Install Deno (if not already installed):
```bash
curl -fsSL https://deno.land/install.sh | sh
```

3. Run in development mode:
```bash
deno task dev
```

4. Run in production:
```bash
deno task start
```

### Testing

Use the included `test-api.ts` file:
```bash
deno run --allow-net test-api.ts
```

This will test both the health endpoint and profile batch retrieval.

### Performance Considerations

- The indexer runs continuously in the background
- Profile updates are processed asynchronously
- Database operations are batched when possible
- Rate limiting prevents API abuse
- Relay connections are pooled for efficiency

### Security

- Environment variables for sensitive data
- Rate limiting to prevent DoS attacks
- CORS headers for controlled access
- No storage of private user data
- Read-only Nostr operations

### Future Enhancements

- Machine learning for better profile recommendations
- Geographic or interest-based filtering
- Real-time WebSocket API for live updates
- Profile verification system
- Multi-language profile support