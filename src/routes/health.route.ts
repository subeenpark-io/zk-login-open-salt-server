import { Hono } from "hono";

export const healthRoutes = new Hono();

healthRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get("/ready", async (c) => {
  // TODO: Check provider health
  return c.json({
    status: "ready",
    timestamp: new Date().toISOString(),
  });
});
