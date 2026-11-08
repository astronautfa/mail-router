import * as Effect from "effect/Effect";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as Layer from "effect/Layer";

import { HealthGroup } from "./health.ts";

/** The Worker's HTTP surface. Add new groups here. */
export class MailRouterApi extends HttpApi.make("MailRouterApi").add(
  HealthGroup
) {}

export const HealthLive = HttpApiBuilder.group(
  MailRouterApi,
  "health",
  (handlers) =>
    handlers.handle("check", () => Effect.succeed({ ok: true } as const))
);

/**
 * The full HttpApi as a router layer. It still needs the HTTP platform
 * services (`Etag`, `HttpPlatform`, `Path`, `FileSystem`); the Worker and the
 * tests both provide them with `alchemy/Http`'s `Platform`.
 */
export const ApiLive = HttpApiBuilder.layer(MailRouterApi).pipe(
  Layer.provide(HealthLive)
);
