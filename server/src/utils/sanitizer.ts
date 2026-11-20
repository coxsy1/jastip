import { USER_ROLES, type UserRole } from "../constants/index.js";

const RESTRICTED_NON_OWNER_KEYS = new Set([
  "actualCostForeign",
  "actualCostIdr",
  "costRate",
  "fxRatePaid",
  "totalPaidIdr",
  "totalPaidForeign",
  "profit",
  "profitEst",
]);

const RESTRICTED_WAREHOUSE_KEYS = new Set([
  ...RESTRICTED_NON_OWNER_KEYS,
  "sellPriceIdr",
  "feeIdr",
  "jastipFeeIdr",
  "totalAmount",
  "paidAmount",
  "phoneWa",
  "shipAddress",
  "address",
]);

/**
 * Recursively filters sensitive fields based on the authenticated user's role.
 * - Non-OWNER: strips modal, cost, and profit fields.
 * - WAREHOUSE/SHOPPER: additionally strips pricing, fees, and customer personal details.
 */
export function sanitizeForRole<T = unknown>(role: UserRole | string | undefined, data: T): T {
  if (!data || typeof data !== "object") {
    return data;
  }

  // Owner has full visibility
  if (role === USER_ROLES.OWNER) {
    return data;
  }

  const restrictedKeys =
    role === USER_ROLES.WAREHOUSE || role === USER_ROLES.SHOPPER
      ? RESTRICTED_WAREHOUSE_KEYS
      : RESTRICTED_NON_OWNER_KEYS;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForRole(role, item)) as unknown as T;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (restrictedKeys.has(key)) {
      continue;
    }

    if (value && typeof value === "object") {
      sanitized[key] = sanitizeForRole(role, value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}
