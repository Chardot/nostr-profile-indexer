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