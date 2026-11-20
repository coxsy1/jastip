import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { userController } from "../controllers/user.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import {
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
} from "../validators/auth.validator.js";
import { JsonResponse } from "../utils/response.js";
import { USER_ROLES } from "../constants/index.js";

const userRoutes = new Hono();

// All routes under /users are strictly OWNER ONLY (PRD USR-1..4, AC2)
userRoutes.use("*", authenticate, authorize(USER_ROLES.OWNER));

// GET /users — List users
userRoutes.get("/", (c) => userController.list(c));

// POST /users — Create user
userRoutes.post(
  "/",
  zValidator("json", createUserSchema, (result, c) => {
    if (!result.success) {
      return JsonResponse.badRequest(c, "Validasi pembuatan user gagal", result.error.issues);
    }
  }),
  (c) => userController.create(c)
);

// GET /users/:id — Detail user
userRoutes.get("/:id", (c) => userController.getById(c));

// PATCH /users/:id — Update user
userRoutes.patch(
  "/:id",
  zValidator("json", updateUserSchema, (result, c) => {
    if (!result.success) {
      return JsonResponse.badRequest(c, "Validasi pembaruan user gagal", result.error.issues);
    }
  }),
  (c) => userController.update(c)
);

// PATCH /users/:id/status — Toggle status
userRoutes.patch(
  "/:id/status",
  zValidator("json", updateUserStatusSchema, (result, c) => {
    if (!result.success) {
      return JsonResponse.badRequest(c, "Validasi status user gagal", result.error.issues);
    }
  }),
  (c) => userController.toggleStatus(c)
);

// POST /users/:id/reset-password — Reset password
userRoutes.post("/:id/reset-password", (c) => userController.resetPassword(c));

export { userRoutes };
