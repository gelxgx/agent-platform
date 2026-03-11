import { describe, it, expect } from "vitest";
import { createGateway } from "../../src/gateway/server.js";

describe("Gateway Server", () => {
  const app = createGateway();

  describe("GET /api/health", () => {
    it("should return status ok", async () => {
      const res = await app.request("/api/health");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.version).toBe("0.1.0");
      expect(typeof body.uptime).toBe("number");
    });
  });

  describe("404 handling", () => {
    it("should return 404 for unknown routes", async () => {
      const res = await app.request("/api/nonexistent");
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBe("Not found");
    });
  });
});
