import * as Array from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

export const DEFAULT_ZONE = "example.com";
export const DEFAULT_MATCH_MODE = "catch-all";

/** A structural copy of `Cloudflare.Email.Matcher` (`alchemy/Cloudflare`). */
export type EmailMatcher = { type: "all" } | { type: "literal"; field: "to"; value: string };

const EmailAddress = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
);
const decodeEmailAddress = Schema.decodeUnknownResult(EmailAddress);

/** Fail the deploy with a readable `ConfigError` (the only error the Worker's Construction phase accepts). */
const failConfig = (message: string): Config.Config<never> =>
  Config.fail(new ConfigProvider.SourceError({ message }));

/** Read a comma-separated list of email addresses, dropping blanks and rejecting bad entries. */
const addressList = (name: string): Config.Config<ReadonlyArray<string>> =>
  Config.String(name).pipe(
    Config.withDefault(""),
    Config.flatMap((raw) => {
      const [addresses, rejected] = Array.partition(
        Array.filterMap(raw.split(","), (entry) => {
          const value = entry.trim();
          return value.length === 0 ? Result.failVoid : Result.succeed(value);
        }),
        (value) =>
          Result.isSuccess(decodeEmailAddress(value)) ? Result.succeed(value) : Result.fail(value),
      );

      return Array.isReadonlyArrayEmpty(rejected)
        ? Config.succeed(addresses)
        : failConfig(`${name}: invalid email address(es): ${Array.join(rejected, ", ")}`);
    }),
  );

/** `MAIL_ZONE` — the zone that hosts the Email Routing rules. */
export const Zone: Config.Config<string> = Config.String("MAIL_ZONE").pipe(
  Config.withDefault(DEFAULT_ZONE),
);

/** `MAIL_MATCH_MODE` — `"catch-all"` or `"literal"`. */
export const MatchMode: Config.Config<string> = Config.String("MAIL_MATCH_MODE").pipe(
  Config.withDefault(DEFAULT_MATCH_MODE),
);

/** `MAIL_INBOUND` — comma-separated recipients matched in `literal` mode. */
export const Inbound: Config.Config<ReadonlyArray<string>> = addressList("MAIL_INBOUND");

/** `MAIL_FORWARD_TO` — comma-separated destinations every message is forwarded to. */
export const ForwardTo: Config.Config<ReadonlyArray<string>> = addressList("MAIL_FORWARD_TO");

/**
 * The Email Routing matchers to create, derived from `MatchMode` + `Inbound`.
 * `undefined` means "use the zone catch-all".
 */
export const Matchers: Config.Config<Array<EmailMatcher> | undefined> = Config.all({
  matchMode: MatchMode,
  inbound: Inbound,
}).pipe(
  Config.flatMap(({ matchMode, inbound }) => {
    if (matchMode === "catch-all") return Config.succeed(undefined);
    if (matchMode !== "literal") {
      return failConfig(`MAIL_MATCH_MODE: expected "catch-all" or "literal"; got "${matchMode}"`);
    }
    return Config.succeed(
      Array.match(inbound, {
        onEmpty: () => undefined,
        onNonEmpty: (addresses) =>
          Array.map(addresses, (value): EmailMatcher => ({ type: "literal", field: "to", value })),
      }),
    );
  }),
);
