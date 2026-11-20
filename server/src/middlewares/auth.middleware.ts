import type { Context, Next } from "hono";
import { JsonResponse } from "../utils/response.js";
import { verifyAccessToken, type TokenPayload } from "../utils/jwt.js";
import { userRepository } from "../repositories/user.repository.js";
import { AUTH_CONSTANTS, ERROR_CODES, USER_ROLES, type UserRole } from "../constants/index.js";

/**
 * Authentication middleware that verifies JWT access token, checks active status in DB,
 * and enforces password change requirement.
 */
export async function authenticate(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header(AUTH_CONSTANTS.AUTH_HEADER);
  if (!authHeader || !authHeader.startsWith(AUTH_CONSTANTS.BEARER_PREFIX)) {
    return JsonResponse.unauthorized(c, "Token autentikasi tidak ditemukan", ERROR_CODES.UNAUTHENTICATED);
  }

  const token = authHeader.slice(AUTH_CONSTANTS.BEARER_PREFIX.length);
  let payload: TokenPayload;

  try {
    payload = verifyAccessToken<TokenPayload>(token);
  } catch {
    return JsonResponse.unauthorized(c, "Token tidak valid atau sudah expired", ERROR_CODES.TOKEN_EXPIRED);
  }

  // Verify fresh user status from database (PRD AC11 / USR-3)
  const user = await userRepository.findById(payload.userId);
  if (!user) {
    return JsonResponse.unauthorized(c, "Akun pengguna tidak ditemukan", ERROR_CODES.UNAUTHENTICATED);
  }

  if (!user.isActive) {
    return JsonResponse.forbidden(c, "Akun nonaktif. Silakan hubungi Owner.", ERROR_CODES.USER_INACTIVE);
  }

  c.set("userId", user.id);
  c.set("email", user.email);
  c.set("role", user.role);
  c.set("mustChangePassword", user.mustChangePassword);

  // Enforce password change policy (PRD AUTH-3, USR-1)
  if (user.mustChangePassword) {
    const path = c.req.path;
    const isAllowedPath =
      path.endsWith("/auth/me") ||
      path.endsWith("/auth/me/password") ||
      path.endsWith("/auth/logout");

    if (!isAllowedPath) {
      return JsonResponse.forbidden(
        c,
        "Wajib mengganti password sebelum dapat mengakses fitur lain",
        ERROR_CODES.PASSWORD_CHANGE_REQUIRED
      );
    }
  }

  await next();
}

/**
 * Authorization middleware for Role-Based Access Control (RBAC).
 * Supports legacy SHOPPER alias for WAREHOUSE role.
 */
export function authorize(...roles: UserRole[]) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    let userRole = c.get("role") as UserRole | undefined;

    // Map legacy SHOPPER to WAREHOUSE
    if (userRole === USER_ROLES.SHOPPER) {
      userRole = USER_ROLES.WAREHOUSE;
    }

    const normalizedAllowedRoles = roles.map((r) =>
      r === USER_ROLES.SHOPPER ? USER_ROLES.WAREHOUSE : r
    );

    if (!userRole || !normalizedAllowedRoles.includes(userRole)) {
      return JsonResponse.forbidden(
        c,
        "Anda tidak memiliki izin untuk mengakses resource ini",
        ERROR_CODES.FORBIDDEN
      );
    }

    await next();
  };
}
