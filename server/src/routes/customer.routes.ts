import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { customerController } from "../controllers/customer.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import {
  createCustomerSchema,
  quickCreateCustomerSchema,
  updateCustomerSchema,
} from "../validators/customer.validator.js";
import { JsonResponse } from "../utils/response.js";
import { USER_ROLES } from "../constants/index.js";

const customerRoutes = new Hono();

// Customer module is strictly restricted to OWNER and ADMIN (PRD RBAC, AC1)
// Warehouse/Shopper access results in 403 Forbidden
customerRoutes.use(
  "*",
  authenticate,
  authorize(USER_ROLES.OWNER, USER_ROLES.ADMIN)
);

// GET /customers — List customers
customerRoutes.get("/", (c) => customerController.list(c));

// POST /customers — Full create customer
customerRoutes.post(
  "/",
  zValidator("json", createCustomerSchema, (result, c) => {
    if (!result.success) {
      return JsonResponse.badRequest(c, "Validasi data customer gagal", result.error.issues);
    }
  }),
  (c) => customerController.create(c)
);

// POST /customers/quick — Quick create (name + phone only, CUS-5)
customerRoutes.post(
  "/quick",
  zValidator("json", quickCreateCustomerSchema, (result, c) => {
    if (!result.success) {
      return JsonResponse.badRequest(c, "Validasi tambah cepat customer gagal", result.error.issues);
    }
  }),
  (c) => customerController.quickCreate(c)
);

// GET /customers/:id — Detail customer
customerRoutes.get("/:id", (c) => customerController.getById(c));

// PATCH /customers/:id — Update customer
customerRoutes.patch(
  "/:id",
  zValidator("json", updateCustomerSchema, (result, c) => {
    if (!result.success) {
      return JsonResponse.badRequest(c, "Validasi pembaruan customer gagal", result.error.issues);
    }
  }),
  (c) => customerController.update(c)
);

// DELETE /customers/:id — Soft delete customer
customerRoutes.delete("/:id", (c) => customerController.delete(c));

// GET /customers/:id/orders — Customer order history and unpaid balance (CUS-4)
customerRoutes.get("/:id/orders", (c) => customerController.getOrders(c));

export { customerRoutes };
