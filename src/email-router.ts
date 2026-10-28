import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

import { ForwardTo, Matchers, Zone } from "./config.ts";
import { forwardToAll } from "./forward.ts";
import { isHealthCheck } from "./health.ts";

/**
 * Cloudflare Email Routing Worker.
 *
 * Configuration is read with `effect/Config` in the Construction phase. Alchemy
 * reads each value from the deploy environment, binds it to the Worker, and
 * re-resolves it from that binding at runtime — so there is no `process.env`
 * plumbing, binding map, or deploy/runtime drift to manage. The recipes in
 * `src/config.ts` validate the values and fail the deploy with a clear message
 * when they are malformed.
 *
 * **Inbound** — `Cloudflare.email({ zone, matchers }).subscribe(...)`
 * auto-creates the zone's Email Routing toggle plus the routing resource
 * (catch-all, or a literal `Email.Rule` per `MAIL_INBOUND` address when
 * `MAIL_MATCH_MODE=literal`) that hands matched mail to this Worker. Each
 * message is forwarded to every address in `MAIL_FORWARD_TO` (see
 * `src/forward.ts` for the fan-out/retry semantics).
 *
 * **HTTP** — `GET /healthz` returns a minimal liveness check (`{ ok: true }`).
 * It intentionally exposes no routing config, addresses, or other internals.
 */
export default class EmailRouter extends Cloudflare.Worker<EmailRouter>()(
  "EmailRouter",
  { main: import.meta.url },
  Effect.gen(function* construction() {
    const zone = yield* Zone;
    const forwardTo = yield* ForwardTo;
    const matchers = yield* Matchers;

    yield* Cloudflare.email({ matchers, zone }).subscribe((message) =>
      Effect.gen(function* handleMessage() {
        // Defense-in-depth: construction already guarantees a non-empty
        // `forwardTo`, so this only fires if the runtime bindings were
        // tampered with after deploy. Reject explicitly rather than accept
        // (and silently drop) the message.
        if (forwardTo.length === 0) {
          yield* Effect.logError(
            `mail-router: no forward targets configured; rejecting message to "${message.to}"`
          );
          yield* message.setReject(
            "mail-router is not configured with any forward targets"
          );

          return;
        }

        const outcome = yield* forwardToAll(message, forwardTo);

        if (outcome.failed.length > 0) {
          yield* Effect.logWarning(
            `mail-router: ${outcome.failed.length}/${forwardTo.length} forward(s) failed for "${message.to}"`
          );
        }
      })
    );

    return {
      fetch: Effect.gen(function* fetch() {
        const request = yield* HttpServerRequest;
        const url = new URL(request.url, "http://internal");

        if (isHealthCheck(request.method, url.pathname)) {
          return yield* HttpServerResponse.json({
            ok: true,
          });
        }

        return HttpServerResponse.text("Not found", { status: 404 });
      }),
    };
  }).pipe(Effect.provide(Cloudflare.EmailEventSourceLive))
) {}
