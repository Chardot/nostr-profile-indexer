import { Router } from "oak";

export const healthRouter = new Router();

healthRouter.get("/api/health", (ctx) => {
  ctx.response.body = { 
    status: "ok", 
    timestamp: new Date().toISOString() 
  };
});