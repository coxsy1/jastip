import { describe, it } from "node:test";
import assert from "node:assert";
import { normalizePhoneWa } from "../../src/utils/phone.js";
import { validatePasswordPolicy } from "../../src/utils/password.js";
import { InMemoryRateLimiter } from "../../src/utils/rate-limiter.js";
import { sanitizeForRole } from "../../src/utils/sanitizer.js";
import { parsePaginationParams, buildPaginationMeta } from "../../src/utils/pagination.js";
import { USER_ROLES } from "../../src/constants/index.js";

describe("Unit Tests: Utilities", () => {
  describe("WhatsApp Phone Normalization (CUS-1, AC7)", () => {
    it("should normalize 08... format to 628...", () => {
      assert.strictEqual(normalizePhoneWa("08123456789"), "628123456789");
    });

    it("should normalize +628... format to 628...", () => {
      assert.strictEqual(normalizePhoneWa("+628123456789"), "628123456789");
    });

    it("should normalize 8... format to 628...", () => {
      assert.strictEqual(normalizePhoneWa("81234567890"), "6281234567890");
    });

    it("should keep valid 628... as is", () => {
      assert.strictEqual(normalizePhoneWa("628123456789"), "628123456789");
    });

    it("should strip formatting characters (spaces, dashes, brackets)", () => {
      assert.strictEqual(normalizePhoneWa("+62 (812)-3456-7890"), "6281234567890");
    });

    it("should reject non-mobile Indonesian prefixes (e.g. landline 021...)", () => {
      assert.throws(() => normalizePhoneWa("0215551234"), /nomor seluler/);
    });

    it("should reject abnormally short numbers", () => {
      assert.throws(() => normalizePhoneWa("0812"), /tidak wajar/);
    });

    it("should reject abnormally long numbers", () => {
      assert.throws(() => normalizePhoneWa("081234567890123456"), /tidak wajar/);
    });
  });

  describe("Password Policy Validation (AUTH-5)", () => {
    it("should accept valid password containing both letters and numbers", () => {
      assert.strictEqual(validatePasswordPolicy("Password123!"), true);
      assert.strictEqual(validatePasswordPolicy("secret99"), true);
    });

    it("should reject password shorter than 8 characters", () => {
      assert.strictEqual(validatePasswordPolicy("Pass1"), false);
      assert.strictEqual(validatePasswordPolicy(""), false);
    });

    it("should reject password without numbers", () => {
      assert.strictEqual(validatePasswordPolicy("PasswordOnly"), false);
    });

    it("should reject password without letters", () => {
      assert.strictEqual(validatePasswordPolicy("123456789"), false);
    });
  });

  describe("Rate Limiter (AUTH-4)", () => {
    it("should allow up to 4 failed attempts and block on the 5th attempt", () => {
      const limiter = new InMemoryRateLimiter(5, 10000);
      const key = "127.0.0.1:test@example.com";

      assert.strictEqual(limiter.isBlocked(key).blocked, false);

      for (let i = 1; i <= 4; i++) {
        const res = limiter.recordFailure(key);
        assert.strictEqual(res.blocked, false);
        assert.strictEqual(res.remaining, 5 - i);
      }

      // 5th failure blocks
      const finalAttempt = limiter.recordFailure(key);
      assert.strictEqual(finalAttempt.blocked, true);
      assert.strictEqual(limiter.isBlocked(key).blocked, true);

      // Reset
      limiter.reset(key);
      assert.strictEqual(limiter.isBlocked(key).blocked, false);
    });
  });

  describe("Sanitizer for Role (D14, AC1, AC2)", () => {
    const rawData = {
      orderId: "ORD-001",
      customerName: "Budi",
      phoneWa: "628123456789",
      address: "Jl. Sudirman No. 1",
      sellPriceIdr: 100000,
      feeIdr: 25000,
      actualCostForeign: 50.5,
      actualCostIdr: 80000,
      costRate: 15500,
      profit: 20000,
    };

    it("should preserve all fields for OWNER", () => {
      const sanitized = sanitizeForRole(USER_ROLES.OWNER, rawData);
      assert.deepStrictEqual(sanitized, rawData);
    });

    it("should strip cost/modal and profit fields for ADMIN (AC2)", () => {
      const sanitized = sanitizeForRole(USER_ROLES.ADMIN, rawData);
      assert.strictEqual(sanitized.actualCostForeign, undefined);
      assert.strictEqual(sanitized.actualCostIdr, undefined);
      assert.strictEqual(sanitized.costRate, undefined);
      assert.strictEqual(sanitized.profit, undefined);
      // Operational fields preserved for Admin
      assert.strictEqual(sanitized.sellPriceIdr, 100000);
      assert.strictEqual(sanitized.phoneWa, "628123456789");
    });

    it("should strip cost/modal, profit, pricing, and personal data for WAREHOUSE (AC1)", () => {
      const sanitized = sanitizeForRole(USER_ROLES.WAREHOUSE, rawData);
      assert.strictEqual(sanitized.actualCostForeign, undefined);
      assert.strictEqual(sanitized.costRate, undefined);
      assert.strictEqual(sanitized.profit, undefined);
      assert.strictEqual(sanitized.sellPriceIdr, undefined);
      assert.strictEqual(sanitized.feeIdr, undefined);
      assert.strictEqual(sanitized.phoneWa, undefined);
      assert.strictEqual(sanitized.address, undefined);
      // Safe operational field preserved
      assert.strictEqual(sanitized.orderId, "ORD-001");
    });
  });

  describe("Pagination Helpers (D17)", () => {
    it("should parse default values when omitted", () => {
      const params = parsePaginationParams({});
      assert.strictEqual(params.page, 1);
      assert.strictEqual(params.limit, 20);
      assert.strictEqual(params.skip, 0);
    });

    it("should enforce max limit of 100", () => {
      const params = parsePaginationParams({ page: "2", limit: "500" });
      assert.strictEqual(params.page, 2);
      assert.strictEqual(params.limit, 100);
      assert.strictEqual(params.skip, 100);
    });

    it("should build accurate pagination metadata", () => {
      const params = { page: 2, limit: 10, skip: 10 };
      const meta = buildPaginationMeta(45, params);
      assert.strictEqual(meta.page, 2);
      assert.strictEqual(meta.limit, 10);
      assert.strictEqual(meta.total, 45);
      assert.strictEqual(meta.totalPages, 5);
      assert.strictEqual(meta.hasNextPage, true);
      assert.strictEqual(meta.hasPrevPage, true);
    });
  });
});
