import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import { describe, expect, it } from "vite-plus/test";
import { ForwardTo, Matchers, MatchMode, Zone } from "../src/config.ts";

const parse = <A>(config: Config.Config<A>, env: Record<string, string>) =>
  Effect.runSync(Effect.result(config.parse(ConfigProvider.fromUnknown(env))));

/** Extract the failure message, failing the test when parsing unexpectedly succeeds. */
const failure = <A>(config: Config.Config<A>, env: Record<string, string>): string => {
  const result = parse(config, env);
  if (Result.isFailure(result)) return result.failure.message;
  throw new Error(`expected config to fail, but it succeeded: ${JSON.stringify(env)}`);
};

describe("MAIL_ZONE", () => {
  it("rejects missing or blank zones instead of deploying against the wrong zone", () => {
    expect(failure(Zone, {})).toContain("MAIL_ZONE");
    expect(failure(Zone, { MAIL_ZONE: "  " })).toContain("MAIL_ZONE");
  });
});

describe("MAIL_MATCH_MODE", () => {
  it("defaults to catch-all", () => {
    expect(Result.getOrThrow(parse(MatchMode, {}))).toBe("catch-all");
  });

  it("fails fast for an unknown mode", () => {
    expect(failure(MatchMode, { MAIL_MATCH_MODE: "catchall" })).toContain("MAIL_MATCH_MODE");
  });
});

describe("MAIL_FORWARD_TO", () => {
  it("splits, trims, and drops blanks", () => {
    expect(Result.getOrThrow(parse(ForwardTo, { MAIL_FORWARD_TO: "a@x.com, b@x.com ,," }))).toEqual(
      ["a@x.com", "b@x.com"],
    );
  });

  it("requires at least one destination instead of deploying a router that rejects all mail", () => {
    expect(failure(ForwardTo, {})).toContain("MAIL_FORWARD_TO");
    expect(failure(ForwardTo, { MAIL_FORWARD_TO: " , ," })).toContain("MAIL_FORWARD_TO");
  });

  it("fails with a readable message for a bad address", () => {
    expect(failure(ForwardTo, { MAIL_FORWARD_TO: "a@x.com, nope" })).toContain(
      "invalid email address(es): nope",
    );
  });
});

describe("matchers", () => {
  it("uses the zone catch-all when the mode is catch-all", () => {
    expect(Result.getOrThrow(parse(Matchers, { MAIL_MATCH_MODE: "catch-all" }))).toBeUndefined();
  });

  it("builds one literal rule per inbound address", () => {
    expect(
      Result.getOrThrow(
        parse(Matchers, { MAIL_MATCH_MODE: "literal", MAIL_INBOUND: "a@x.com, b@x.com" }),
      ),
    ).toEqual([
      { type: "literal", field: "to", value: "a@x.com" },
      { type: "literal", field: "to", value: "b@x.com" },
    ]);
  });

  it("fails for literal mode with no inbound addresses instead of silently falling back to catch-all", () => {
    expect(failure(Matchers, { MAIL_MATCH_MODE: "literal" })).toContain("MAIL_INBOUND");
  });
});
