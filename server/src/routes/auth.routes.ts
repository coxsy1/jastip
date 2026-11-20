import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authController } from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
} from "../validators/auth.validator.js";
import { JsonResponse } from "../utils/response.js";

const authRoutes = new Hono();

// ==========================================
// 1. PUBLIC ROUTES (TIDAK Butuh Autentikasi)
// ==========================================

// Login endpoint with request body validation & rate limit
authRoutes.post(
  "/login",
  zValidator("json", loginSchema, (result, c) => {
    if (!result.success) {
      return JsonResponse.badRequest(c, "Validasi input login gagal", result.error.issues);
    }
  }),
  (c) => authController.login(c)
);

// Register endpoint (for initial setup & testing; in PRD primary creation is via /users by Owner)
authRoutes.post(
  "/register",
  zValidator("json", registerSchema, (result, c) => {
    if (!result.success) {
      return JsonResponse.badRequest(c, "Validasi input registrasi gagal", result.error.issues);
    }
  }),
  (c) => authController.register(c)
);

// Refresh token rotation endpoint
authRoutes.post("/refresh", (c) => authController.refreshToken(c));

// ==========================================
// 2. PROTECTED ROUTES (BUTUH Autentikasi)
// ==========================================

// User profile endpoint
authRoutes.get("/me", authenticate, (c) => authController.me(c));

// Self-service password change endpoint (PRD AUTH-3)
authRoutes.patch(
  "/me/password",
  authenticate,
  zValidator("json", changePasswordSchema, (result, c) => {
    if (!result.success) {
      return JsonResponse.badRequest(c, "Validasi ganti password gagal", result.error.issues);
    }
  }),
  (c) => authController.changePassword(c)
);

// User logout endpoint
authRoutes.post("/logout", authenticate, (c) => authController.logout(c));

export { authRoutes };
