import type * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { describe, expect, it } from "vite-plus/test";
import { forwardToAll } from "../src/forward.ts";

/** A test double exposing only the `forward` capability `forwardToAll` uses. */
const fake = (
  forward: (to: string) => Effect.Effect<void, unknown>,
): Cloudflare.ForwardableEmailMessage => ({ forward }) as Cloudflare.ForwardableEmailMessage;

describe("forwardToAll", () => {
  it("forwards to every destination", async () => {
    const seen: string[] = [];
    const message = fake((to) =>
      Effect.sync(() => {
        seen.push(to);
      }),
    );

    const outcome = await Effect.runPromise(forwardToAll(message, ["a@x.com", "b@x.com"]));

    expect(outcome.forwarded.toSorted()).toEqual(["a@x.com", "b@x.com"]);
    expect(outcome.failed).toEqual([]);
    expect(seen.toSorted()).toEqual(["a@x.com", "b@x.com"]);
  });

  it("accepts the envelope when at least one destination succeeds", async () => {
    const message = fake((to) =>
      to === "bad@x.com" ? Effect.fail(`cannot reach ${to}`) : Effect.void,
    );

    const outcome = await Effect.runPromise(forwardToAll(message, ["ok@x.com", "bad@x.com"]));

    expect(outcome.forwarded).toEqual(["ok@x.com"]);
    expect(outcome.failed.map((f) => f.target)).toEqual(["bad@x.com"]);
  });

  it("fails when every destination fails so Cloudflare retries delivery", async () => {
    const message = fake(() => Effect.fail("smtp down"));

    await expect(Effect.runPromise(forwardToAll(message, ["a@x.com"]))).rejects.toBeDefined();
  });
});
