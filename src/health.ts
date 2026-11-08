import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as Schema from "effect/Schema";

/**
 * Liveness response. Intentionally minimal: it exposes no routing config,
 * addresses, or other internals.
 */
export const HealthStatus = Schema.Struct({ ok: Schema.Literal(true) });

/**
 * `GET /healthz` — the Worker's liveness endpoint.
 *
 * Declared as an `HttpApiGroup` so method + path matching, response encoding,
 * and 404s for everything else are handled by Effect's HttpApi router rather
 * than hand-written string comparisons. The handler lives in `src/api.ts`.
 */
export class HealthGroup extends HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("check", "/healthz", { success: HealthStatus })
) {}
