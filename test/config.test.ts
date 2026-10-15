import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import { describe, expect, it } from "vite-plus/test";
import { ForwardTo, Matchers } from "../src/config.ts";

const parse = <A>(config: Config.Config<A>, env: Record<string, string>) =>
  Effect.runSync(Effect.result(config.parse(ConfigProvider.fromUnknown(env))));

describe("MAIL_FORWARD_TO", () => {
  it("splits, trims, and drops blanks", () => {
    const result = parse(ForwardTo, { MAIL_FORWARD_TO: "a@x.com, b@x.com ,," });
    expect(Result.getOrThrow(result)).toEqual(["a@x.com", "b@x.com"]);
  });

  it("is empty when unset", () => {
    expect(Result.getOrThrow(parse(ForwardTo, {}))).toEqual([]);
  });

  it("fails with a readable message for a bad address", () => {
    const result = parse(ForwardTo, { MAIL_FORWARD_TO: "a@x.com, nope" });
    if (Result.isFailure(result)) {
      expect(result.failure.message).toContain("invalid email address(es): nope");
    } else {
      expect.unreachable();
    }
  });
});

describe("matchers", () => {
  it("uses the zone catch-all when the mode is catch-all", () => {
    expect(Result.getOrThrow(parse(Matchers, { MAIL_MATCH_MODE: "catch-all" }))).toBeUndefined();
  });

  it("builds one literal rule per inbound address", () => {
    const result = parse(Matchers, {
      MAIL_MATCH_MODE: "literal",
      MAIL_INBOUND: "a@x.com, b@x.com",
    });
    expect(Result.getOrThrow(result)).toEqual([
      { type: "literal", field: "to", value: "a@x.com" },
      { type: "literal", field: "to", value: "b@x.com" },
    ]);
  });

  it("fails for an unknown mode", () => {
    const result = parse(Matchers, { MAIL_MATCH_MODE: "catchall" });
    if (Result.isFailure(result)) {
      expect(result.failure.message).toContain("MAIL_MATCH_MODE");
    } else {
      expect.unreachable();
    }
  });
});
