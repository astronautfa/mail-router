import { describe, expect, it } from "vite-plus/test";
import { isHealthCheck } from "../src/health.ts";

describe("isHealthCheck", () => {
  it("matches only GET /healthz", () => {
    expect(isHealthCheck("GET", "/healthz")).toBe(true);

    const rejected: Array<[string, string]> = [
      ["GET", "/"],
      ["POST", "/healthz"],
      ["HEAD", "/healthz"],
      ["GET", "/healthz/extra"],
      ["GET", "/readyz"],
    ];
    for (const [method, pathname] of rejected) {
      expect(isHealthCheck(method, pathname)).toBe(false);
    }
  });
});
