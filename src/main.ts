import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { routes } from "./routes/index.js";
import { errorHandler } from "./middleware/error-handler.js";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";

const app = new Hono();

// Middleware
app.onError(errorHandler);

// Routes
app.route("/", routes);

// Start server
const port = config.port;

logger.info(`Starting zkLogin Salt Server on port ${port.toString()}`);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info: { port: number }) => {
    logger.info(`Server listening on http://localhost:${info.port.toString()}`);
  }
);

export default app;
