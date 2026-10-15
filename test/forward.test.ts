import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { describe, expect, it } from "vite-plus/test";

import { forwardToAll } from "../src/forward.ts";

/** Build the tagged error `forwardToAll` reports when a forward fails. */
const emailError = (message: string) =>
  new Cloudflare.EmailError({
    action: "forward",
    cause: message,
    message,
  });

/** A test double exposing only the `forward` capability `forwardToAll` uses. */
const fake = (
  forward: (to: string) => Effect.Effect<void, Cloudflare.EmailError>
): Pick<Cloudflare.ForwardableEmailMessage, "forward"> => ({ forward });

describe(forwardToAll, () => {
  it("forwards to every destination", async () => {
    const message = fake(() => Effect.void);

    const outcome = await Effect.runPromise(
      forwardToAll(message, ["a@x.com", "b@x.com"])
    );

    expect(outcome.forwarded.toSorted()).toStrictEqual(["a@x.com", "b@x.com"]);
    expect(outcome.failed).toStrictEqual([]);
  });

  it("accepts the envelope when at least one destination succeeds", async () => {
    const message = fake((to) =>
      to === "bad@x.com"
        ? Effect.fail(emailError(`cannot reach ${to}`))
        : Effect.void
    );

    const outcome = await Effect.runPromise(
      forwardToAll(message, ["ok@x.com", "bad@x.com"])
    );

    expect(outcome.forwarded).toStrictEqual(["ok@x.com"]);
    expect(outcome.failed.map((f) => f.target)).toStrictEqual(["bad@x.com"]);
  });

  it("fails when every destination fails so Cloudflare retries delivery", async () => {
    const message = fake(() => Effect.fail(emailError("smtp down")));

    await expect(
      Effect.runPromise(forwardToAll(message, ["a@x.com"]))
    ).rejects.toBeDefined();
  });
});
