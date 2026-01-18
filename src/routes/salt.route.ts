import { Hono } from "hono";
import { verifyJWT } from "../services/jwt.service.js";
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

    const verified = await verifyJWT(body.jwt);

    if (!verified.result.valid) {
      return c.json<ErrorResponse>(
        {
          error: "invalid_jwt",
          message: verified.result.error ?? "JWT verification failed",
        },
        401
      );
    }

    const claims = verified.result.claims;
    if (!claims?.sub) {
      return c.json<ErrorResponse>(
        {
          error: "invalid_jwt",
          message: "JWT missing subject claim",
        },
        400
      );
    }

    const audience = Array.isArray(claims.aud) ? claims.aud[0] : claims.aud;
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
    const salt = await saltProvider.getSalt(claims.sub, audience, body.jwt);

    logger.info("Salt generated successfully", {
      provider: verified.provider?.name,
    });

    return c.json<SaltResponse>({ salt });
  } catch (error) {
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
