import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authController } from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  refreshTokenSchema,
} from "../validators/auth.validator.js";
import { config } from "../config/index.js";
import { ERROR_CODES } from "../constants/index.js";
import { JsonResponse } from "../utils/response.js";

const authRoutes = new Hono();

// ==========================================
// 1. PUBLIC ROUTES (Tidak Butuh Autentikasi)
// ==========================================

// POST /auth/login — Rate limit + anti-enumeration ada di controller
authRoutes.post(
  "/login",
  zValidator("json", loginSchema, (result, c) => {
    if (!result.success) {
      return JsonResponse.badRequest(c, "Validasi input login gagal", result.error.issues);
    }
  }),
  (c) => authController.login(c)
);

// POST /auth/register — Diblokir di environment production (PRD USR-1)
authRoutes.post(
  "/register",
  (c, next) => {
    if (config.app.env === "production") {
      return JsonResponse.forbidden(
        c,
        "Registrasi publik dinonaktifkan. Akun baru hanya dapat dibuat oleh Owner via POST /api/v1/users",
        ERROR_CODES.FORBIDDEN
      );
    }
    return next();
  },
  zValidator("json", registerSchema, (result, c) => {
    if (!result.success) {
      return JsonResponse.badRequest(c, "Validasi input registrasi gagal", result.error.issues);
    }
  }),
  (c) => authController.register(c)
);

// POST /auth/refresh — Rotasi refresh token dengan validasi body
authRoutes.post(
  "/refresh",
  zValidator("json", refreshTokenSchema, (result, c) => {
    if (!result.success) {
      return JsonResponse.badRequest(c, "Validasi refresh token gagal", result.error.issues);
    }
  }),
  (c) => authController.refreshToken(c)
);

// ==========================================
// 2. PROTECTED ROUTES (Butuh Autentikasi JWT)
// ==========================================

// GET /auth/me — Profil user saat ini
authRoutes.get("/me", authenticate, (c) => authController.me(c));

// PATCH /auth/me/password — Ganti password mandiri (PRD AUTH-3)
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

// POST /auth/logout — Revoke refresh token
authRoutes.post("/logout", authenticate, (c) => authController.logout(c));

export { authRoutes };
