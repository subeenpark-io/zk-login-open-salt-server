import { Hono } from "hono";
import { verifyJWT, JWTError } from "../services/jwt.service.js";
import { createProvider, type SaltProvider } from "../providers/index.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

export const saltRoutes = new Hono();

let provider: SaltProvider | null = null;

async function getProvider(): Promise<SaltProvider> {
  if (!provider) {
    provider = await createProvider(config.saltProvider);
  }
  return provider;
}

interface SaltRequest {
  jwt: string;
}

interface SaltResponse {
  salt: string;
}

interface ErrorResponse {
  error: string;
  message: string;
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

    // Verify JWT
    const verified = await verifyJWT(body.jwt);
    const { sub, aud } = verified.payload;

    if (!sub) {
      return c.json<ErrorResponse>(
        {
          error: "invalid_jwt",
          message: "JWT missing subject claim",
        },
        400
      );
    }

    // Get audience (can be string or array)
    const audience = Array.isArray(aud) ? aud[0] : aud;
    if (!audience) {
      return c.json<ErrorResponse>(
        {
          error: "invalid_jwt",
          message: "JWT missing audience claim",
        },
        400
      );
    }

    // Get salt
    const saltProvider = await getProvider();
    const salt = await saltProvider.getSalt(sub, audience);

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
