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

// Force redeploy with updated env vars
