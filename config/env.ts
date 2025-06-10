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