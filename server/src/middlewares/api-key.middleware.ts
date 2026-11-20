import crypto from "node:crypto";
import type { Context, Next } from "hono";
import { config } from "../config/index.js";
import { AUTH_CONSTANTS, ERROR_CODES } from "../constants/index.js";
import { JsonResponse } from "../utils/response.js";

/**
 * Constant-time string comparison to prevent timing attacks
 */
function isApiKeyValid(providedKey: string, expectedKey: string): boolean {
  const providedBuffer = Buffer.from(providedKey);
  const expectedBuffer = Buffer.from(expectedKey);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

export interface ApiKeyOptions {
  allowHealthCheck?: boolean;
}

/**
 * Middleware to validate incoming request's 'x-api-key' header.
 * Only requests carrying a valid x-api-key can access protected endpoints.
 */ 
export function validateApiKey({ allowHealthCheck = true }: ApiKeyOptions = {}) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    // Optionally allow health check endpoint for monitoring/uptime probes
    if (allowHealthCheck && c.req.path.endsWith("/health")) {
      return next();
    }

    const apiKey = c.req.header(AUTH_CONSTANTS.API_KEY_HEADER);

    if (!apiKey) {
      return JsonResponse.unauthorized(
        c,
        "Header 'x-api-key' wajib disertakan untuk mengakses API",
        ERROR_CODES.MISSING_API_KEY
      );
    }

    if (!isApiKeyValid(apiKey, config.security.apiKey)) {
      return JsonResponse.unauthorized(
        c,
        "Token 'x-api-key' tidak valid",
        ERROR_CODES.INVALID_API_KEY
      );
    }

    await next();
  };
}

export const apiKeyMiddleware = validateApiKey();
