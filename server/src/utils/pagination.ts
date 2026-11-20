import { PAGINATION_DEFAULTS } from "../constants/index.js";

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function parsePaginationParams(query: Record<string, unknown>): PaginationParams {
  const pageRaw = Number(query.page);
  const limitRaw = Number(query.limit);

  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : PAGINATION_DEFAULTS.DEFAULT_PAGE;
  const limit =
    Number.isInteger(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, PAGINATION_DEFAULTS.MAX_LIMIT)
      : PAGINATION_DEFAULTS.DEFAULT_LIMIT;

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export function buildPaginationMeta(total: number, params: PaginationParams): PaginationMeta {
  const totalPages = Math.ceil(total / params.limit) || 1;
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages,
    hasNextPage: params.page < totalPages,
    hasPrevPage: params.page > 1,
  };
}
