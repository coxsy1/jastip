import { Hono } from "hono";
import { authRoutes } from "./auth.routes.js";
import { userRoutes } from "./user.routes.js";
import { customerRoutes } from "./customer.routes.js";
import { JsonResponse } from "../utils/response.js";
import { db } from "../db/client.js";

const apiRouter = new Hono();

/**
 * Public Health Check Endpoint with DB probe
 */
apiRouter.get("/health", async (c) => {
  let dbStatus = "disconnected";
  try {
    // Ping DB to ensure deploy readiness probe validity
    await db.$queryRawUnsafe("SELECT 1");
    dbStatus = "connected";
  } catch (err: any) {
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

// Mount modular sub-routers
apiRouter.route("/auth", authRoutes);
apiRouter.route("/users", userRoutes);
apiRouter.route("/customers", customerRoutes);

export { apiRouter };
