import type { Context } from "hono";
import { logger } from "../utils/logger.js";

export function errorHandler(err: Error, c: Context): Response {
  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
  });

  return c.json(
    {
      error: "internal_error",
      message: "An unexpected error occurred",
    },
    500
  );
}
