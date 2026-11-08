import * as Http from "alchemy/Http";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";
import { afterAll, describe, expect, it } from "vite-plus/test";

import { ApiLive } from "../src/api.ts";

describe("GET /healthz", () => {
  // Drive the real router with web `Request`s, the same shape the Worker's
  // `fetch` receives, so method/path matching and 404s are covered end to end.
  const { handler, dispose } = HttpRouter.toWebHandler(
    ApiLive.pipe(Layer.provide(Http.Platform)),
    { disableLogger: true }
  );

  afterAll(async () => {
    await dispose();
  });

  const send = async (method: string, path: string): Promise<Response> =>
    await handler(new Request(`http://worker.test${path}`, { method }));

  it("returns { ok: true }", async () => {
    const response = await send("GET", "/healthz");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ ok: true });
  });

  it.each([
    ["GET", "/"],
    ["POST", "/healthz"],
    ["GET", "/healthz/extra"],
    ["GET", "/readyz"],
  ])("returns 404 for %s %s", async (method, path) => {
    const response = await send(method, path);

    expect(response.status).toBe(404);
  });
});
