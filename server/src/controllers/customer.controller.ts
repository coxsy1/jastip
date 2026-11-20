import type { Context } from "hono";
import { JsonResponse } from "../utils/response.js";
import { customerService } from "../services/customer.service.js";
import { AppError } from "../utils/error.js";
import { parsePaginationParams, buildPaginationMeta } from "../utils/pagination.js";
import { sanitizeForRole } from "../utils/sanitizer.js";
import type {
  CreateCustomerInput,
  QuickCreateCustomerInput,
  UpdateCustomerInput,
} from "../validators/customer.validator.js";

export class CustomerController {
  /**
   * GET /customers — List customers with filters and pagination.
   */
  async list(c: Context): Promise<Response> {
    try {
      const role = c.get("role");
      const query = c.req.query();
      const pagination = parsePaginationParams(query);
      const filter = {
        q: query.q,
        tag: query.tag as any,
        waOptIn: query.waOptIn !== undefined ? query.waOptIn === "true" : undefined,
        page: pagination.page,
        limit: pagination.limit,
      };

      const result = await customerService.listCustomers(filter);
      const meta = buildPaginationMeta(result.total, pagination);
      const sanitized = sanitizeForRole(role, result.customers);

      return JsonResponse.success(c, sanitized, "Daftar customer berhasil diambil", meta as any);
    } catch (err: any) {
      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }

  /**
   * GET /customers/:id — Get customer detail by ID.
   */
  async getById(c: Context): Promise<Response> {
    try {
      const role = c.get("role");
      const id = c.req.param("id") as string;
      const customer = await customerService.getCustomerById(id);
      const sanitized = sanitizeForRole(role, customer);

      return JsonResponse.success(c, sanitized, "Detail customer berhasil diambil");
    } catch (err: any) {
      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }

  /**
   * POST /customers — Create full customer.
   */
  async create(c: Context): Promise<Response> {
    try {
      const actorId = c.get("userId") as string;
      const role = c.get("role");
      const body = c.req.valid("json" as never) as CreateCustomerInput;
      const customer = await customerService.createCustomer(body, actorId);
      const sanitized = sanitizeForRole(role, customer);

      return JsonResponse.created(c, sanitized, "Customer berhasil ditambahkan");
    } catch (err: any) {
      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }

  /**
   * POST /customers/quick — Quick create (name + phone only for CUS-5).
   */
  async quickCreate(c: Context): Promise<Response> {
    try {
      const actorId = c.get("userId") as string;
      const role = c.get("role");
      const body = c.req.valid("json" as never) as QuickCreateCustomerInput;
      const customer = await customerService.quickCreateCustomer(body, actorId);
      const sanitized = sanitizeForRole(role, customer);

      return JsonResponse.created(c, sanitized, "Customer berhasil ditambahkan (cepat)");
    } catch (err: any) {
      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }

  /**
   * PATCH /customers/:id — Update customer data.
   */
  async update(c: Context): Promise<Response> {
    try {
      const actorId = c.get("userId") as string;
      const role = c.get("role");
      const id = c.req.param("id") as string;
      const body = c.req.valid("json" as never) as UpdateCustomerInput;
      const updated = await customerService.updateCustomer(id, body, actorId);
      const sanitized = sanitizeForRole(role, updated);

      return JsonResponse.success(c, sanitized, "Data customer berhasil diperbarui");
    } catch (err: any) {
      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }

  /**
   * DELETE /customers/:id — Soft delete customer.
   */
  async delete(c: Context): Promise<Response> {
    try {
      const actorId = c.get("userId") as string;
      const id = c.req.param("id") as string;
      await customerService.deleteCustomer(id, actorId);

      return JsonResponse.success(c, null, "Customer berhasil dihapus");
    } catch (err: any) {
      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }

  /**
   * GET /customers/:id/orders — Get customer transaction history and debt (CUS-4).
   */
  async getOrders(c: Context): Promise<Response> {
    try {
      const id = c.req.param("id") as string;
      const orders = await customerService.getCustomerOrders(id);

      return JsonResponse.success(c, orders, "Riwayat pesanan customer berhasil diambil");
    } catch (err: any) {
      if (err instanceof AppError) {
        return JsonResponse.error(c, err.code, err.message, err.statusCode, err.details);
      }
      return JsonResponse.internalServerError(c, err?.message ?? "Terjadi kesalahan server");
    }
  }
}

export const customerController = new CustomerController();
