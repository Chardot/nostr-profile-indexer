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