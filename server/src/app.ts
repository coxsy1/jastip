import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { config } from "./config/index.js";
import { apiRouter } from "./routes/index.js";
import { AUTH_CONSTANTS, ERROR_CODES } from "./constants/index.js";
import { apiKeyMiddleware } from "./middlewares/index.js";
import { JsonResponse } from "./utils/response.js";
import { AppError } from "./utils/error.js";

const app = new Hono();

// Global Middlewares
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: config.cors.origin,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "Idempotency-Key",
      AUTH_CONSTANTS.API_KEY_HEADER,
    ],
  })
);

// Traffic Protection: Enforce valid x-api-key across API routes
app.use(`${config.app.apiPrefix}/*`, apiKeyMiddleware);

// Mount API Routes
app.route(config.app.apiPrefix, apiRouter);

// Global 404 Handler
app.notFound((c) => {
  return JsonResponse.notFound(c, `Route not found: ${c.req.method} ${c.req.url}`);
});

// Global Error Handler
app.onError((err: any, c) => {
  console.error("[GLOBAL_ERROR_HANDLER]:", err);

  if (err instanceof AppError) {
    return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
  }

  // Handle Prisma unique constraint violation (P2002)
  if (err?.code === "P2002") {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : "field";
    return JsonResponse.conflict(c, `Data dengan ${target} tersebut sudah terdaftar`);
  }

  // Handle Prisma record not found (P2025)
  if (err?.code === "P2025") {
    return JsonResponse.notFound(c, "Data tidak ditemukan atau sudah dihapus");
  }

  // Handle Prisma malformed UUID / invalid input format (P2023)
  if (err?.code === "P2023") {
    return JsonResponse.badRequest(
      c,
      "Format parameter ID tidak valid (harus berupa UUID)",
      undefined,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  // Generic fallback without leaking sensitive internal details
  const message = config.app.env === "development" ? err.message : "Terjadi kesalahan internal pada server";
  return JsonResponse.internalServerError(c, message, ERROR_CODES.INTERNAL_ERROR);
});

export { app };
