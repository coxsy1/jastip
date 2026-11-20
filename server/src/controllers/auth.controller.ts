import type { Context } from "hono";
import { JsonResponse } from "../utils/response.js";
import { authService } from "../services/auth.service.js";
import { loginRateLimiter } from "../utils/rate-limiter.js";
import { ERROR_CODES } from "../constants/index.js";
import { AppError } from "../utils/error.js";

function getClientMeta(c: Context) {
  const forwardedFor = c.req.header("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : c.req.header("x-real-ip") || "127.0.0.1";
  const userAgent = c.req.header("user-agent") || null;
  return { ip, userAgent };
}

export class AuthController {
  /**
   * POST /auth/login — Login with rate-limiting & anti-enumeration protection.
   */
  async login(c: Context): Promise<Response> {
    const meta = getClientMeta(c);
    const body = c.req.valid("json" as never) as { email: string; password: string };
    const rateLimitKey = `${meta.ip}:${body.email.toLowerCase().trim()}`;

    // Rate limiting check: max 5 failed attempts per 15 minutes (PRD AUTH-4)
    const { blocked, retryAfterMs } = loginRateLimiter.isBlocked(rateLimitKey);
    if (blocked) {
      const minutes = Math.ceil(retryAfterMs / 60000);
      return JsonResponse.tooManyRequests(
        c,
        `Terlalu banyak percobaan login gagal. Silakan coba lagi dalam ${minutes} menit.`,
        { retryAfterMs },
        ERROR_CODES.RATE_LIMITED
      );
    }

    try {
      const result = await authService.login(body, meta);
      // Reset rate limiter on successful authentication
      loginRateLimiter.reset(rateLimitKey);

      return JsonResponse.success(c, result, "Login berhasil");
    } catch (err: any) {
      // Record failed attempt in rate limiter
      loginRateLimiter.recordFailure(rateLimitKey);

      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }

  /**
   * POST /auth/register — Restricted registration.
   */
  async register(c: Context): Promise<Response> {
    try {
      const meta = getClientMeta(c);
      const body = c.req.valid("json" as never) as {
        name: string;
        email: string;
        password: string;
        role?: any;
      };
      const result = await authService.register(body, meta);
      return JsonResponse.created(c, result, "Registrasi berhasil");
    } catch (err: any) {
      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }

  /**
   * GET /auth/me — Current authenticated user profile.
   */
  async me(c: Context): Promise<Response> {
    try {
      const userId = c.get("userId") as string;
      const user = await authService.getProfile(userId);
      return JsonResponse.success(c, user, "Profil berhasil diambil");
    } catch (err: any) {
      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }

  /**
   * PATCH /auth/me/password — Self-service password change.
   */
  async changePassword(c: Context): Promise<Response> {
    try {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json" as never) as { oldPassword: string; newPassword: string };
      await authService.changePassword(userId, body);
      return JsonResponse.success(c, null, "Password berhasil diubah");
    } catch (err: any) {
      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }

  /**
   * POST /auth/logout — Revokes refresh tokens.
   */
  async logout(c: Context): Promise<Response> {
    try {
      const userId = c.get("userId") as string;
      const body = await c.req.json().catch(() => null);
      const token = body?.refreshToken;

      await authService.logout(userId, token);
      return JsonResponse.success(c, null, "Logout berhasil");
    } catch (err: any) {
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }

  /**
   * POST /auth/refresh — Token rotation endpoint.
   */
  async refreshToken(c: Context): Promise<Response> {
    try {
      const meta = getClientMeta(c);
      const body = await c.req.json().catch(() => null) as { refreshToken?: string } | null;
      const token = body?.refreshToken;

      if (!token) {
        return JsonResponse.badRequest(c, "Refresh token wajib disertakan");
      }

      const result = await authService.refreshToken(token, meta);
      return JsonResponse.success(c, result, "Token berhasil diperbarui");
    } catch (err: any) {
      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }
}

export const authController = new AuthController();
