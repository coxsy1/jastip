import { describe, it, before } from "node:test";
import assert from "node:assert";
import { app } from "../../src/app.js";
import { setupInMemoryStore } from "../helpers/mock-store.js";
import { loginRateLimiter } from "../../src/utils/rate-limiter.js";
import { ERROR_CODES, USER_ROLES } from "../../src/constants/index.js";

const API_KEY = "jastipops-secure-api-key-2026";
const BASE_URL = "http://localhost/api/v1";

describe("Integration Tests: Tahap 1 (Auth & User Management)", () => {
  before(async () => {
    await setupInMemoryStore();
  });

  describe("API Key Traffic Protection", () => {
    it("should reject requests without x-api-key with 401 MISSING_API_KEY", async () => {
      const res = await app.request(`${BASE_URL}/auth/me`, {
        method: "GET",
      });
      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.error.code, ERROR_CODES.MISSING_API_KEY);
    });

    it("should reject requests with invalid x-api-key with 401 INVALID_API_KEY", async () => {
      const res = await app.request(`${BASE_URL}/auth/me`, {
        method: "GET",
        headers: { "x-api-key": "wrong-key" },
      });
      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.error.code, ERROR_CODES.INVALID_API_KEY);
    });
  });

  describe("Authentication Flow (Login, Rate Limit, Profile)", () => {
    it("should fail login with incorrect password (401 INVALID_CREDENTIALS)", async () => {
      const res = await app.request(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({
          email: "owner@jastipops.com",
          password: "WrongPassword123!",
        }),
      });

      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.error.code, ERROR_CODES.INVALID_CREDENTIALS);
    });

    it("should trigger rate limiter after 5 failed attempts (429 RATE_LIMITED, AUTH-4)", async () => {
      const email = "rate-limit-test@jastipops.com";
      // Perform 5 failures
      for (let i = 0; i < 5; i++) {
        await app.request(`${BASE_URL}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
            "x-forwarded-for": "10.0.0.99",
          },
          body: JSON.stringify({
            email,
            password: "WrongPassword123!",
          }),
        });
      }

      // 6th attempt must be blocked by rate limiter
      const res = await app.request(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "x-forwarded-for": "10.0.0.99",
        },
        body: JSON.stringify({
          email,
          password: "Password123!",
        }),
      });

      assert.strictEqual(res.status, 429);
      const body = await res.json();
      assert.strictEqual(body.error.code, ERROR_CODES.RATE_LIMITED);

      // Reset limiter for this test key
      loginRateLimiter.reset(`10.0.0.99:${email}`);
    });

    it("should login successfully with valid credentials and return tokens", async () => {
      const res = await app.request(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({
          email: "owner@jastipops.com",
          password: "Password123!",
        }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.tokens.accessToken);
      assert.ok(body.data.tokens.refreshToken);
      assert.strictEqual(body.data.user.email, "owner@jastipops.com");
      assert.strictEqual(body.data.user.role, USER_ROLES.OWNER);
      assert.strictEqual(body.data.user.password, undefined); // password stripped
    });
  });

  describe("Protected Endpoints & Token Rotation", () => {
    let accessToken: string;
    let refreshToken: string;

    before(async () => {
      // Login as Admin
      const res = await app.request(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({
          email: "admin@jastipops.com",
          password: "Password123!",
        }),
      });
      const body = await res.json();
      accessToken = body.data.tokens.accessToken;
      refreshToken = body.data.tokens.refreshToken;
    });

    it("should get profile via GET /auth/me with valid Bearer token", async () => {
      const res = await app.request(`${BASE_URL}/auth/me`, {
        method: "GET",
        headers: {
          "x-api-key": API_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.email, "admin@jastipops.com");
    });

    it("should rotate refresh token on POST /auth/refresh", async () => {
      const res = await app.request(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({ refreshToken }),
      });

      const body = await res.json();
      if (res.status !== 200) {
        console.error("FAIL BODY ON REFRESH:", body);
      }
      assert.strictEqual(res.status, 200);
      assert.ok(body.data.accessToken);
      assert.ok(body.data.refreshToken);

      // Verify old token cannot be reused (Token Reuse Detection)
      const reuseRes = await app.request(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({ refreshToken }),
      });

      assert.strictEqual(reuseRes.status, 401);
    });

    it("should change password via PATCH /auth/me/password", async () => {
      const loginRes = await app.request(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ email: "admin@jastipops.com", password: "Password123!" }),
      });
      const token = (await loginRes.json()).data.tokens.accessToken;

      const res = await app.request(`${BASE_URL}/auth/me/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          oldPassword: "Password123!",
          newPassword: "NewSecretPassword2026!",
        }),
      });

      assert.strictEqual(res.status, 200);

      // Verify login works with new password
      const newLoginRes = await app.request(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ email: "admin@jastipops.com", password: "NewSecretPassword2026!" }),
      });
      assert.strictEqual(newLoginRes.status, 200);
    });
  });

  describe("RBAC & User Management (Owner Only, /users)", () => {
    let ownerToken: string;
    let adminToken: string;
    let warehouseToken: string;

    before(async () => {
      const ownerRes = await app.request(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ email: "owner@jastipops.com", password: "Password123!" }),
      });
      ownerToken = (await ownerRes.json()).data.tokens.accessToken;

      const adminRes = await app.request(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ email: "admin@jastipops.com", password: "NewSecretPassword2026!" }),
      });
      adminToken = (await adminRes.json()).data.tokens.accessToken;

      const warehouseRes = await app.request(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ email: "warehouse@jastipops.com", password: "Password123!" }),
      });
      warehouseToken = (await warehouseRes.json()).data.tokens.accessToken;
    });

    it("should reject Admin from accessing /users with 403 FORBIDDEN (AC2)", async () => {
      const res = await app.request(`${BASE_URL}/users`, {
        method: "GET",
        headers: { "x-api-key": API_KEY, Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    it("should reject Warehouse from accessing /users with 403 FORBIDDEN (AC1)", async () => {
      const res = await app.request(`${BASE_URL}/users`, {
        method: "GET",
        headers: { "x-api-key": API_KEY, Authorization: `Bearer ${warehouseToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    it("should allow Owner to list users via GET /users", async () => {
      const res = await app.request(`${BASE_URL}/users`, {
        method: "GET",
        headers: { "x-api-key": API_KEY, Authorization: `Bearer ${ownerToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(body.data.length >= 3);
      assert.ok(body.meta.total >= 3);
    });

    it("should allow Owner to create a new user with mustChangePassword = true (USR-1)", async () => {
      const res = await app.request(`${BASE_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          name: "Staf Baru",
          email: "stafbaru@jastipops.com",
          role: "ADMIN",
        }),
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.data.user.email, "stafbaru@jastipops.com");
      assert.strictEqual(body.data.user.mustChangePassword, true);
      assert.ok(body.data.initialPassword);
    });

    it("should prevent deactivating the last active Owner (LAST_OWNER_PROTECTED, USR-4)", async () => {
      const res = await app.request(`${BASE_URL}/users/user-owner-001/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ isActive: false }),
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error.code, ERROR_CODES.LAST_OWNER_PROTECTED);
    });
  });
});
