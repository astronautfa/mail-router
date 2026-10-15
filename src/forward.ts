import type * as Cloudflare from "alchemy/Cloudflare";
import * as Array from "effect/Array";
import * as Effect from "effect/Effect";

export interface ForwardOutcome {
  /** Destinations the message was delivered to. */
  readonly forwarded: ReadonlyArray<string>;
  /** Destinations that rejected the forward, with the underlying error. */
  readonly failed: ReadonlyArray<{
    readonly target: string;
    readonly error: Cloudflare.EmailError;
  }>;
}

/**
 * Fan a single message out to every destination.
 *
 * Semantics chosen so Cloudflare's retry model never duplicates or drops mail:
 *
 * - **All destinations succeed** → resolve with the outcome.
 * - **Some succeed, some fail** → resolve (accept the envelope). Retrying would
 *   re-deliver to the destinations that already got the mail, so the failures
 *   are reported for the caller to log instead.
 * - **Every destination fails** → re-raise the first error so the `email`
 *   handler fails, which Cloudflare turns into a temporary SMTP failure and the
 *   sending server retries later.
 */
export const forwardToAll = (
  message: Cloudflare.ForwardableEmailMessage,
  targets: ReadonlyArray<string>,
): Effect.Effect<ForwardOutcome, Cloudflare.EmailError> =>
  Effect.gen(function* () {
    const [forwarded, failed] = yield* Effect.partition(
      targets,
      (target) =>
        message.forward(target).pipe(
          Effect.tap(() => Effect.logInfo(`mail-router: forwarded to ${target}`)),
          Effect.as(target),
          Effect.mapError((error) => ({ target, error })),
        ),
      { concurrency: "unbounded" },
    );

    if (Array.isReadonlyArrayNonEmpty(failed) && Array.isReadonlyArrayEmpty(forwarded)) {
      return yield* Effect.fail(Array.headNonEmpty(failed).error);
    }

    return { forwarded, failed };
  });
