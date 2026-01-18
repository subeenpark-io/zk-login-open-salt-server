import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HTTPException } from "hono/http-exception";
import { logger } from "../utils/logger.js";
import { JWTError } from "../services/jwt.service.js";
import type { ErrorResponse } from "../types/index.js";

interface ErrorMapping {
  status: ContentfulStatusCode;
  code: string;
  message: string;
  logLevel: "warn" | "error";
}

function classifyError(err: Error): ErrorMapping {
  if (err instanceof JWTError) {
    return {
      status: 401,
      code: err.code,
      message: err.message,
      logLevel: "warn",
    };
  }

  if (err instanceof HTTPException) {
    return {
      status: err.status as ContentfulStatusCode,
      code: `http_${err.status.toString()}`,
      message: err.message || "HTTP error",
      logLevel: err.status >= 500 ? "error" : "warn",
    };
  }

  if (err.name === "SyntaxError" && err.message.includes("JSON")) {
    return {
      status: 400,
      code: "invalid_json",
      message: "Invalid JSON in request body",
      logLevel: "warn",
    };
  }

  return {
    status: 500,
    code: "internal_error",
    message: "An unexpected error occurred",
    logLevel: "error",
  };
}

export function errorHandler(err: Error, c: Context): Response {
  const { status, code, message, logLevel } = classifyError(err);

  const logData = {
    code,
    path: c.req.path,
    method: c.req.method,
  };

  if (logLevel === "error") {
    logger.error(err.message, { ...logData, stack: err.stack });
  } else {
    logger.warn(err.message, logData);
  }

  return c.json<ErrorResponse>({ error: code, message }, status);
}
