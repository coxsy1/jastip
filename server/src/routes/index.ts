import { Hono } from "hono";
import { authRoutes } from "./auth.routes.js";
import { userRoutes } from "./user.routes.js";
import { customerRoutes } from "./customer.routes.js";
import { clientRoutes } from "./client.routes.js";
import { JsonResponse } from "../utils/response.js";
import { db } from "../db/client.js";

const apiRouter = new Hono();

// ============================================================================
// 1. SYSTEM & HEALTH CHECK
// ============================================================================
apiRouter.get("/health", async (c) => {
  let dbStatus = "disconnected";
  try {
    // Ping DB to ensure deploy readiness probe validity
    await db.$queryRawUnsafe("SELECT 1");
    dbStatus = "connected";
  } catch {
    dbStatus = "error";
  }

  const isHealthy = dbStatus === "connected";
  const payload = {
    status: isHealthy ? "ok" : "degraded",
    database: dbStatus,
    timestamp: new Date().toISOString(),
  };

  if (!isHealthy) {
    return c.json(
      {
        success: false,
        message: "Layanan terdegradasi: koneksi database bermasalah",
        data: payload,
      },
      503
    );
  }

  return JsonResponse.success(c, payload);
});

// ============================================================================
// 2. ADMIN PANEL / BACK OFFICE ROUTES (INTERNAL OPERATIONS)
// Memerlukan autentikasi JWT + penegakan RBAC (Owner, Admin, Warehouse)
// ============================================================================
apiRouter.route("/auth", authRoutes);
apiRouter.route("/users", userRoutes);
apiRouter.route("/customers", customerRoutes);

// ============================================================================
// 3. WEB CLIENT / CUSTOMER PORTAL ROUTES (PUBLIC / CLIENT-FACING)
// Layanan publik mandiri untuk pelanggan (katalog promo, tracking order, invoice)
// ============================================================================
apiRouter.route("/client", clientRoutes);

export { apiRouter };

