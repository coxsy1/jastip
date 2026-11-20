import { describe, it, before } from "node:test";
import assert from "node:assert";
import { app } from "../../src/app.js";
import { setupInMemoryStore } from "../helpers/mock-store.js";
import { ERROR_CODES, CUSTOMER_TAGS } from "../../src/constants/index.js";

const API_KEY = "jastipops-secure-api-key-2026";
const BASE_URL = "http://localhost/api/v1";

describe("Integration Tests: Tahap 2 (Customer / CRM Module)", () => {
  let ownerToken: string;
  let adminToken: string;
  let warehouseToken: string;

  before(async () => {
    await setupInMemoryStore();

    // Login Owner
    const ownerRes = await app.request(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ email: "owner@jastipops.com", password: "Password123!" }),
    });
    ownerToken = (await ownerRes.json()).data.tokens.accessToken;

    // Login Admin
    const adminRes = await app.request(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ email: "admin@jastipops.com", password: "Password123!" }),
    });
    adminToken = (await adminRes.json()).data.tokens.accessToken;

    // Login Warehouse
    const warehouseRes = await app.request(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ email: "warehouse@jastipops.com", password: "Password123!" }),
    });
    warehouseToken = (await warehouseRes.json()).data.tokens.accessToken;
  });

  describe("RBAC Access Control (/customers)", () => {
    it("should reject Warehouse from accessing /customers with 403 FORBIDDEN (AC1)", async () => {
      const res = await app.request(`${BASE_URL}/customers`, {
        method: "GET",
        headers: { "x-api-key": API_KEY, Authorization: `Bearer ${warehouseToken}` },
      });
      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error.code, ERROR_CODES.FORBIDDEN);
    });

    it("should reject unauthenticated request with 401 UNAUTHENTICATED", async () => {
      const res = await app.request(`${BASE_URL}/customers`, {
        method: "GET",
        headers: { "x-api-key": API_KEY },
      });
      assert.strictEqual(res.status, 401);
    });

    it("should allow Admin and Owner to access /customers", async () => {
      const resAdmin = await app.request(`${BASE_URL}/customers`, {
        method: "GET",
        headers: { "x-api-key": API_KEY, Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(resAdmin.status, 200);

      const resOwner = await app.request(`${BASE_URL}/customers`, {
        method: "GET",
        headers: { "x-api-key": API_KEY, Authorization: `Bearer ${ownerToken}` },
      });
      assert.strictEqual(resOwner.status, 200);
    });
  });

  describe("Customer CRUD, Phone Normalization & Duplication Check", () => {
    let createdCustomerId: string;

    it("should create customer with WA normalization (0812... -> 62812...)", async () => {
      const res = await app.request(`${BASE_URL}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: "Siti Rahma",
          phoneWa: "0812-9876-5432",
          city: "Jakarta Selatan",
          tag: CUSTOMER_TAGS.VIP,
        }),
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.name, "Siti Rahma");
      assert.strictEqual(body.data.phoneWa, "6281298765432"); // normalized!
      assert.strictEqual(body.data.tag, CUSTOMER_TAGS.VIP);
      assert.strictEqual(body.data.waOptIn, true);

      createdCustomerId = body.data.id;
    });

    it("should quick-create customer with name and phone only (CUS-5)", async () => {
      const res = await app.request(`${BASE_URL}/customers/quick`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: "Budi Santoso",
          phoneWa: "+62 813 4455 6677",
        }),
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.data.name, "Budi Santoso");
      assert.strictEqual(body.data.phoneWa, "6281344556677");
      assert.strictEqual(body.data.tag, CUSTOMER_TAGS.REGULAR);
    });

    it("should reject duplicate WhatsApp phone number with 409 DUPLICATE_PHONE (CUS-5, AC7)", async () => {
      const res = await app.request(`${BASE_URL}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: "Siti Kloning",
          phoneWa: "081298765432", // same phone as first customer!
        }),
      });

      assert.strictEqual(res.status, 409);
      const body = await res.json();
      assert.strictEqual(body.error.code, ERROR_CODES.DUPLICATE_PHONE);
    });

    it("should get customer detail by ID", async () => {
      const res = await app.request(`${BASE_URL}/customers/${createdCustomerId}`, {
        method: "GET",
        headers: { "x-api-key": API_KEY, Authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.id, createdCustomerId);
      assert.strictEqual(body.data.name, "Siti Rahma");
    });

    it("should search customer by name or phoneWa (CUS-3)", async () => {
      // Search by name
      const resName = await app.request(`${BASE_URL}/customers?q=siti`, {
        method: "GET",
        headers: { "x-api-key": API_KEY, Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(resName.status, 200);
      const bodyName = await resName.json();
      assert.strictEqual(bodyName.data.length, 1);
      assert.strictEqual(bodyName.data[0].name, "Siti Rahma");

      // Search by phone digits
      const resPhone = await app.request(`${BASE_URL}/customers?q=9876`, {
        method: "GET",
        headers: { "x-api-key": API_KEY, Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(resPhone.status, 200);
      const bodyPhone = await resPhone.json();
      assert.strictEqual(bodyPhone.data.length, 1);
      assert.strictEqual(bodyPhone.data[0].phoneWa, "6281298765432");
    });

    it("should filter customers by tag", async () => {
      const res = await app.request(`${BASE_URL}/customers?tag=VIP`, {
        method: "GET",
        headers: { "x-api-key": API_KEY, Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.every((c: any) => c.tag === "VIP"), true);
    });

    it("should update customer data via PATCH /customers/:id", async () => {
      const res = await app.request(`${BASE_URL}/customers/${createdCustomerId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          notes: "Pelanggan langganan jastip kosmetik",
          address: "Jl. Melati No. 10",
        }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.notes, "Pelanggan langganan jastip kosmetik");
      assert.strictEqual(body.data.address, "Jl. Melati No. 10");
    });

    it("should get customer order history and balance summary via GET /customers/:id/orders (CUS-4)", async () => {
      const res = await app.request(`${BASE_URL}/customers/${createdCustomerId}/orders`, {
        method: "GET",
        headers: { "x-api-key": API_KEY, Authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body.data.orders));
      assert.strictEqual(body.data.totalSpent, 0);
      assert.strictEqual(body.data.unpaidAmount, 0);
    });

    it("should soft-delete customer via DELETE /customers/:id (CUS-8)", async () => {
      const deleteRes = await app.request(`${BASE_URL}/customers/${createdCustomerId}`, {
        method: "DELETE",
        headers: { "x-api-key": API_KEY, Authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(deleteRes.status, 200);

      // Verify customer no longer appears in normal list
      const listRes = await app.request(`${BASE_URL}/customers`, {
        method: "GET",
        headers: { "x-api-key": API_KEY, Authorization: `Bearer ${adminToken}` },
      });
      const listBody = await listRes.json();
      const found = listBody.data.find((c: any) => c.id === createdCustomerId);
      assert.strictEqual(found, undefined);

      // Verify GET /customers/:id returns 404
      const getRes = await app.request(`${BASE_URL}/customers/${createdCustomerId}`, {
        method: "GET",
        headers: { "x-api-key": API_KEY, Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(getRes.status, 404);
    });
  });
});
