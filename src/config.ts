import * as Array from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import { pipe } from "effect/Function";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

/**
 * Mirrors `Matcher` from `alchemy/Cloudflare` (`Email/Rule.ts`). Kept local
 * so config parsing stays free of deploy-tooling imports.
 */
export type EmailMatcher =
  | { type: "all" }
  | { type: "literal"; field: "to"; value: string };

const EmailAddress = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u))
);

const decodeEmailAddress = Schema.decodeUnknownResult(EmailAddress);

/** Fail the deploy with a readable `ConfigError` (the only error the Worker's Construction phase accepts). */
const failConfig = (message: string): Config.Config<never> =>
  Config.fail(new ConfigProvider.SourceError({ message }));

/** Read a comma-separated list of email addresses, dropping blanks and rejecting bad entries. */
const addressList = (name: string): Config.Config<readonly string[]> =>
  Config.String(name).pipe(
    Config.withDefault(""),
    Config.flatMap((raw) => {
      const [addresses, rejected] = Array.partition(
        Array.filterMap(raw.split(","), (entry) => {
          const value = entry.trim();

          return value.length === 0 ? Result.failVoid : Result.succeed(value);
        }),
        (value) =>
          Result.isSuccess(decodeEmailAddress(value))
            ? Result.succeed(value)
            : Result.fail(value)
      );

      return Array.isReadonlyArrayEmpty(rejected)
        ? Config.succeed(addresses)
        : failConfig(
            `${name}: invalid email address(es): ${Array.join(rejected, ", ")}`
          );
    })
  );

/**
 * `MAIL_ZONE` — the zone that hosts the Email Routing rules. Required with no
 * default, so a missing value fails the deploy instead of silently targeting
 * `example.com`. Blank values fail too: an empty zone would only surface later
 * as a zone-lookup failure at runtime.
 */
export const Zone: Config.Config<string> = Config.String("MAIL_ZONE").pipe(
  Config.flatMap((zone) =>
    zone.trim().length === 0
      ? failConfig("MAIL_ZONE: zone must not be blank")
      : Config.succeed(zone)
  )
);

/** `MAIL_MATCH_MODE` — `"catch-all"` or `"literal"`, validated at the source so a typo fails fast. */
export const MatchMode: Config.Config<string> = Config.String(
  "MAIL_MATCH_MODE"
).pipe(
  Config.withDefault("catch-all"),
  Config.flatMap((mode) =>
    mode === "catch-all" || mode === "literal"
      ? Config.succeed(mode)
      : failConfig(
          `MAIL_MATCH_MODE: expected "catch-all" or "literal"; got "${mode}"`
        )
  )
);

/** `MAIL_INBOUND` — comma-separated recipients matched in `literal` mode. */
export const Inbound: Config.Config<readonly string[]> =
  addressList("MAIL_INBOUND");

/**
 * `MAIL_FORWARD_TO` — comma-separated destinations every message is forwarded
 * to. At least one is required: an empty list would reject all mail at runtime.
 */
export const ForwardTo: Config.Config<readonly string[]> = addressList(
  "MAIL_FORWARD_TO"
).pipe(
  Config.flatMap((addresses) =>
    Array.isReadonlyArrayEmpty(addresses)
      ? failConfig(
          "MAIL_FORWARD_TO: at least one forward destination is required"
        )
      : Config.succeed(addresses)
  )
);

/**
 * The Email Routing matchers to create, derived from `MatchMode` + `Inbound`.
 * `undefined` means "use the zone catch-all".
 */
export const Matchers: Config.Config<EmailMatcher[] | undefined> = Config.all({
  inbound: Inbound,
  matchMode: MatchMode,
}).pipe(
  Config.flatMap(({ matchMode, inbound }) => {
    if (matchMode === "catch-all") {
      // `undefined` is the domain's catch-all signal: `Cloudflare.email`
      // expects `matchers?: Matcher[]`, so omitting the value selects the
      // zone catch-all. This is a meaningful absence, not a useless one.
      // eslint-disable-next-line unicorn/no-useless-undefined -- catch-all is selected by omitting matchers
      return Config.succeed(undefined);
    }

    if (Array.isReadonlyArrayEmpty(inbound)) {
      return failConfig(
        "MAIL_INBOUND: at least one address is required when MAIL_MATCH_MODE=literal"
      );
    }

    return Config.succeed(
      pipe(
        inbound,
        Array.map((value): EmailMatcher => ({
          field: "to",
          type: "literal",
          value,
        }))
      )
    );
  })
);
