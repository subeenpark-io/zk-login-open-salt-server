import { Hono } from "hono";

export const adminRoutes = new Hono();

// TODO: Add authentication middleware for admin routes

adminRoutes.get("/stats", (c) => {
  // TODO: Implement stats endpoint
  return c.json({
    message: "Admin stats endpoint - not yet implemented",
  });
});

adminRoutes.post("/cache/clear", (c) => {
  // TODO: Implement cache clearing
  return c.json({
    message: "Cache cleared",
  });
});
