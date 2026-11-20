import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HTTP_STATUS, ERROR_CODES } from "../constants/index.js";

/**
 * Interface for standardized successful JSON response payload
 */
export interface SuccessPayload<T = unknown> {
  success: true;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
}

/**
 * Interface for standardized error JSON response payload
 */
export interface ErrorPayload {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Universal class for handling standardized API JSON responses and HTTP status codes.
 * Supports both static method calls and instance method calls with Hono Context.
 */
export class JsonResponse {
  private readonly c?: Context;

  constructor(c?: Context) {
    this.c = c;
  }

  // ==========================================
  // STATIC METHODS (Primary Usage)
  // ==========================================

  /**
   * Returns a standardized 200 OK (or custom success code) JSON response.
   */
  static success<T>(
    c: Context,
    data?: T,
    message?: string,
    meta?: Record<string, unknown>,
    statusCode: ContentfulStatusCode = HTTP_STATUS.OK
  ): Response {
    return c.json<SuccessPayload<T>>(
      {
        success: true,
        ...(message && { message }),
        ...(data !== undefined && { data }),
        ...(meta && { meta }),
      },
      statusCode
    );
  }

  /**
   * Returns a standardized 201 Created JSON response.
   */
  static created<T>(
    c: Context,
    data: T,
    message?: string,
    meta?: Record<string, unknown>
  ): Response {
    return this.success(c, data, message, meta, HTTP_STATUS.CREATED);
  }

  /**
   * Returns a standardized 204 No Content response.
   */
  static noContent(c: Context): Response {
    return c.body(null, HTTP_STATUS.NO_CONTENT);
  }

  /**
   * Returns a standardized error JSON response with custom status code.
   */
  static error(
    c: Context,
    code: string,
    message: string,
    statusCode: ContentfulStatusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    details?: unknown
  ): Response {
    return c.json<ErrorPayload>(
      {
        success: false,
        error: {
          code,
          message,
          ...(details !== undefined && { details }),
        },
      },
      statusCode
    );
  }

  /**
   * Returns a 400 Bad Request error response (e.g., validation failure).
   */
  static badRequest(
    c: Context,
    message: string,
    details?: unknown,
    code: string = ERROR_CODES.VALIDATION_ERROR
  ): Response {
    return this.error(c, code, message, HTTP_STATUS.BAD_REQUEST, details);
  }

  /**
   * Returns a 401 Unauthorized error response.
   */
  static unauthorized(
    c: Context,
    message: string = "Autentikasi gagal / belum login",
    code: string = ERROR_CODES.UNAUTHORIZED
  ): Response {
    return this.error(c, code, message, HTTP_STATUS.UNAUTHORIZED);
  }

  /**
   * Returns a 403 Forbidden error response.
   */
  static forbidden(
    c: Context,
    message: string = "Akses ditolak / tidak memiliki hak akses",
    code: string = ERROR_CODES.FORBIDDEN
  ): Response {
    return this.error(c, code, message, HTTP_STATUS.FORBIDDEN);
  }

  /**
   * Returns a 404 Not Found error response.
   */
  static notFound(
    c: Context,
    message: string = "Data atau endpoint tidak ditemukan",
    code: string = ERROR_CODES.NOT_FOUND
  ): Response {
    return this.error(c, code, message, HTTP_STATUS.NOT_FOUND);
  }

  /**
   * Returns a 409 Conflict error response.
   */
  static conflict(
    c: Context,
    message: string = "Konflik data terdeteksi",
    code: string = ERROR_CODES.CONFLICT
  ): Response {
    return this.error(c, code, message, HTTP_STATUS.CONFLICT);
  }

  /**
   * Returns a 422 Unprocessable Entity error response.
   */
  static unprocessable(
    c: Context,
    message: string,
    details?: unknown,
    code: string = ERROR_CODES.VALIDATION_ERROR
  ): Response {
    return this.error(c, code, message, HTTP_STATUS.UNPROCESSABLE_ENTITY, details);
  }

  /**
   * Returns a 429 Too Many Requests error response.
   */
  static tooManyRequests(
    c: Context,
    message: string = "Terlalu banyak permintaan. Silakan coba lagi nanti.",
    details?: unknown,
    code: string = ERROR_CODES.RATE_LIMITED
  ): Response {
    return this.error(c, code, message, HTTP_STATUS.TOO_MANY_REQUESTS, details);
  }

  /**
   * Returns a 503 Service Unavailable error response.
   */
  static serviceUnavailable(
    c: Context,
    message: string = "Layanan sedang tidak tersedia",
    code: string = ERROR_CODES.INTERNAL_SERVER_ERROR,
    details?: unknown
  ): Response {
    return this.error(c, code, message, HTTP_STATUS.SERVICE_UNAVAILABLE, details);
  }

  /**
   * Returns a 500 Internal Server Error response.
   */
  static internalServerError(
    c: Context,
    message: string = "Terjadi kesalahan internal pada server",
    code: string = ERROR_CODES.INTERNAL_SERVER_ERROR
  ): Response {
    return this.error(c, code, message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  // ==========================================
  // INSTANCE METHODS (Convenience Usage)
  // ==========================================

  private ensureContext(): Context {
    if (!this.c) {
      throw new Error("Hono Context is required for instance methods. Pass Context to new JsonResponse(c).");
    }
    return this.c;
  }

  success<T>(data?: T, message?: string, meta?: Record<string, unknown>, statusCode?: ContentfulStatusCode): Response {
    return JsonResponse.success(this.ensureContext(), data, message, meta, statusCode);
  }

  created<T>(data: T, message?: string, meta?: Record<string, unknown>): Response {
    return JsonResponse.created(this.ensureContext(), data, message, meta);
  }

  noContent(): Response {
    return JsonResponse.noContent(this.ensureContext());
  }

  error(code: string, message: string, statusCode?: ContentfulStatusCode, details?: unknown): Response {
    return JsonResponse.error(this.ensureContext(), code, message, statusCode, details);
  }

  badRequest(message: string, details?: unknown, code?: string): Response {
    return JsonResponse.badRequest(this.ensureContext(), message, details, code);
  }

  unauthorized(message?: string, code?: string): Response {
    return JsonResponse.unauthorized(this.ensureContext(), message, code);
  }

  forbidden(message?: string, code?: string): Response {
    return JsonResponse.forbidden(this.ensureContext(), message, code);
  }

  notFound(message?: string, code?: string): Response {
    return JsonResponse.notFound(this.ensureContext(), message, code);
  }

  conflict(message?: string, code?: string): Response {
    return JsonResponse.conflict(this.ensureContext(), message, code);
  }

  unprocessable(message: string, details?: unknown, code?: string): Response {
    return JsonResponse.unprocessable(this.ensureContext(), message, details, code);
  }

  internalServerError(message?: string, code?: string): Response {
    return JsonResponse.internalServerError(this.ensureContext(), message, code);
  }
}

// Export ApiResponse as alias
export { JsonResponse as ApiResponse };
