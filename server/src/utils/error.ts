import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ERROR_CODES, HTTP_STATUS, type ErrorCode } from "../constants/index.js";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: ContentfulStatusCode;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: ErrorCode = ERROR_CODES.INTERNAL_ERROR,
    statusCode: ContentfulStatusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, code: ErrorCode = ERROR_CODES.VALIDATION_ERROR, details?: unknown): AppError {
    return new AppError(message, code, HTTP_STATUS.BAD_REQUEST, details);
  }

  static unauthorized(message: string = "Autentikasi gagal / belum login", code: ErrorCode = ERROR_CODES.UNAUTHENTICATED): AppError {
    return new AppError(message, code, HTTP_STATUS.UNAUTHORIZED);
  }

  static forbidden(message: string = "Akses ditolak / tidak memiliki izin", code: ErrorCode = ERROR_CODES.FORBIDDEN): AppError {
    return new AppError(message, code, HTTP_STATUS.FORBIDDEN);
  }

  static notFound(message: string = "Resource tidak ditemukan", code: ErrorCode = ERROR_CODES.NOT_FOUND): AppError {
    return new AppError(message, code, HTTP_STATUS.NOT_FOUND);
  }

  static conflict(message: string, code: ErrorCode = ERROR_CODES.CONFLICT, details?: unknown): AppError {
    return new AppError(message, code, HTTP_STATUS.CONFLICT, details);
  }

  static rateLimited(message: string = "Terlalu banyak permintaan. Silakan coba lagi nanti.", details?: unknown): AppError {
    return new AppError(message, ERROR_CODES.RATE_LIMITED, HTTP_STATUS.TOO_MANY_REQUESTS, details);
  }

  static internal(message: string = "Terjadi kesalahan internal pada server"): AppError {
    return new AppError(message, ERROR_CODES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
