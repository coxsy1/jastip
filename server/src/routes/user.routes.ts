import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { userController } from "../controllers/user.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import {
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
  resetPasswordSchema,
} from "../validators/auth.validator.js";
import { JsonResponse } from "../utils/response.js";
import { USER_ROLES } from "../constants/index.js";

const userRoutes = new Hono();

// Semua route /users hanya untuk OWNER (PRD USR-1..4, AC2)
userRoutes.use("*", authenticate, authorize(USER_ROLES.OWNER));

// GET /users — Daftar user dengan filter & paginasi
userRoutes.get("/", (c) => userController.list(c));

// POST /users — Buat user baru (password otomatis, mustChangePassword=true)
userRoutes.post(
  "/",
  zValidator("json", createUserSchema, (result, c) => {
    if (!result.success) {
      return JsonResponse.badRequest(c, "Validasi pembuatan user gagal", result.error.issues);
    }
  }),
  (c) => userController.create(c)
);

// GET /users/:id — Detail user berdasarkan ID
userRoutes.get("/:id", (c) => userController.getById(c));

// PATCH /users/:id — Update data / role user
userRoutes.patch(
  "/:id",
  zValidator("json", updateUserSchema, (result, c) => {
    if (!result.success) {
      return JsonResponse.badRequest(c, "Validasi pembaruan user gagal", result.error.issues);
    }
  }),
  (c) => userController.update(c)
);

// PATCH /users/:id/status — Aktif/nonaktifkan user (LAST_OWNER_PROTECTED)
userRoutes.patch(
  "/:id/status",
  zValidator("json", updateUserStatusSchema, (result, c) => {
    if (!result.success) {
      return JsonResponse.badRequest(c, "Validasi status user gagal", result.error.issues);
    }
  }),
  (c) => userController.toggleStatus(c)
);

// POST /users/:id/reset-password — Reset password user (password sementara)
userRoutes.post(
  "/:id/reset-password",
  zValidator("json", resetPasswordSchema, (result, c) => {
    if (!result.success) {
      return JsonResponse.badRequest(c, "Validasi reset password gagal", result.error.issues);
    }
  }),
  (c) => userController.resetPassword(c)
);

export { userRoutes };
