import { describe, it } from "node:test";
import assert from "node:assert";
import { app } from "../../src/app.js";

const BASE_URL = "http://localhost/api/v1";

describe("Health Check Endpoint", () => {
  it("should respond to GET /api/v1/health", async () => {
    const res = await app.request(`${BASE_URL}/health`, {
      method: "GET",
    });

    const body = await res.json();
    assert.ok([200, 503].includes(res.status));
    assert.ok(body.message || body.data?.status || body.data?.database);
  });
});
