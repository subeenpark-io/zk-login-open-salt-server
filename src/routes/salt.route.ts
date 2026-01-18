import { Hono } from "hono";
import { verifyJWT, JWTError } from "../services/jwt.service.js";
import { createProvider } from "../providers/index.js";
import type { SaltProvider } from "../types/index.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import type { SaltRequest, SaltResponse, ErrorResponse } from "../types/index.js";

export const saltRoutes = new Hono();

let provider: SaltProvider | null = null;

async function getProvider(): Promise<SaltProvider> {
  if (!provider) {
    provider = await createProvider(config.saltProvider);
  }
  return provider;
}

saltRoutes.post("/salt", async (c) => {
  try {
    const body = await c.req.json<SaltRequest>();

    if (!body.jwt) {
      return c.json<ErrorResponse>(
        {
          error: "missing_jwt",
          message: "JWT is required",
        },
        400
      );
    }

    // Verify JWT - throws JWTError if invalid
    const verified = await verifyJWT(body.jwt);
    const { payload } = verified;

    if (!payload.sub) {
      return c.json<ErrorResponse>(
        {
          error: "invalid_jwt",
          message: "JWT missing subject claim",
        },
        400
      );
    }

    const audience = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
    if (!audience) {
      return c.json<ErrorResponse>(
        {
          error: "invalid_jwt",
          message: "JWT missing audience claim",
        },
        400
      );
    }

    const saltProvider = await getProvider();
    const salt = await saltProvider.getSalt(payload.sub, audience, body.jwt);

    logger.info("Salt generated successfully", {
      provider: verified.provider.name,
    });

    return c.json<SaltResponse>({ salt });
  } catch (error) {
    if (error instanceof JWTError) {
      return c.json<ErrorResponse>(
        {
          error: error.code,
          message: error.message,
        },
        401
      );
    }

    logger.error("Salt generation failed", { error });

    return c.json<ErrorResponse>(
      {
        error: "internal_error",
        message: "An error occurred while generating salt",
      },
      500
    );
  }
});
