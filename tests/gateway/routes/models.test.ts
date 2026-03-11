import { describe, it, expect, beforeEach } from "vitest";
import { createGateway } from "../../../src/gateway/server.js";
import { resetConfigCache } from "../../../src/config/loader.js";

describe("GET /api/models", () => {
  const app = createGateway();

  beforeEach(() => resetConfigCache());

  it("should return models list and defaultModel", async () => {
    const res = await app.request("/api/models");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.models).toBeDefined();
    expect(Array.isArray(body.models)).toBe(true);
    expect(body.models.length).toBeGreaterThan(0);
    expect(body.defaultModel).toBeDefined();

    const first = body.models[0];
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("displayName");
    expect(first).toHaveProperty("provider");
  });
});
