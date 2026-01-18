import { Hono } from "hono";
import { saltRoutes } from "./salt.route.js";
import { healthRoutes } from "./health.route.js";
import { adminRoutes } from "./admin.route.js";

export const routes = new Hono();

routes.route("/v1", saltRoutes);
routes.route("/", healthRoutes);
routes.route("/admin", adminRoutes);
