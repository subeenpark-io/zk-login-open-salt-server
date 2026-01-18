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

export default {
  port,
  fetch: app.fetch,
};
