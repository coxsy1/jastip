import type { Context } from "hono";
import { JsonResponse } from "../utils/response.js";
import { userService } from "../services/user.service.js";
import { AppError } from "../utils/error.js";
import { parsePaginationParams, buildPaginationMeta } from "../utils/pagination.js";
import type { CreateUserInput, UpdateUserInput, UpdateUserStatusInput, ResetPasswordInput } from "../validators/auth.validator.js";

export class UserController {
  /**
   * GET /users — List users with filters and pagination.
   */
  async list(c: Context): Promise<Response> {
    try {
      const query = c.req.query();
      const pagination = parsePaginationParams(query);
      const filter = {
        q: query.q,
        role: query.role as any,
        isActive: query.isActive !== undefined ? query.isActive === "true" : undefined,
        page: pagination.page,
        limit: pagination.limit,
      };

      const result = await userService.listUsers(filter);
      const meta = buildPaginationMeta(result.total, pagination);

      return JsonResponse.success(c, result.users, "Daftar pengguna berhasil diambil", meta as any);
    } catch (err: any) {
      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }

  /**
   * GET /users/:id — Get user detail by ID.
   */
  async getById(c: Context): Promise<Response> {
    try {
      const id = c.req.param("id") as string;
      const user = await userService.getUserById(id);
      return JsonResponse.success(c, user, "Detail pengguna berhasil diambil");
    } catch (err: any) {
      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }

  /**
   * POST /users — Create a new user (Owner only).
   */
  async create(c: Context): Promise<Response> {
    try {
      const actorId = c.get("userId") as string;
      const body = c.req.valid("json" as never) as CreateUserInput;
      const result = await userService.createUser(body, actorId);
      return JsonResponse.created(c, result, "Pengguna baru berhasil dibuat");
    } catch (err: any) {
      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }

  /**
   * PATCH /users/:id — Update user details or role (Owner only).
   */
  async update(c: Context): Promise<Response> {
    try {
      const actorId = c.get("userId") as string;
      const id = c.req.param("id") as string;
      const body = c.req.valid("json" as never) as UpdateUserInput;
      const updated = await userService.updateUser(id, body, actorId);
      return JsonResponse.success(c, updated, "Data pengguna berhasil diperbarui");
    } catch (err: any) {
      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }

  /**
   * PATCH /users/:id/status — Toggle active status of user (Owner only).
   */
  async toggleStatus(c: Context): Promise<Response> {
    try {
      const actorId = c.get("userId") as string;
      const id = c.req.param("id") as string;
      const body = c.req.valid("json" as never) as UpdateUserStatusInput;
      const updated = await userService.toggleStatus(id, body.isActive, actorId);
      const actionMsg = body.isActive ? "diaktifkan" : "dinonaktifkan";
      return JsonResponse.success(c, updated, `Pengguna berhasil ${actionMsg}`);
    } catch (err: any) {
      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }

  /**
   * POST /users/:id/reset-password — Reset user password (Owner only).
   */
  async resetPassword(c: Context): Promise<Response> {
    try {
      const actorId = c.get("userId") as string;
      const id = c.req.param("id") as string;
      const body = (await c.req.json().catch(() => ({}))) as ResetPasswordInput;
      const result = await userService.resetPassword(id, body.newPassword, actorId);
      return JsonResponse.success(c, result, "Password pengguna berhasil direset");
    } catch (err: any) {
      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }
}

export const userController = new UserController();
