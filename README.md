# mail-router

A Cloudflare Worker that receives mail through **Email Routing** and forwards
each message to **several** destinations — unlike the dashboard's single
forward — built with [Alchemy](https://alchemy.run) (deploy) and
[Effect](https://effect.website) (runtime), developed with
[Vite+](https://viteplus.dev) (`vp`).

## How it works

- `alchemy.run.ts` — the stack. Deploys the Worker and exposes its URL.
- `src/config.ts` — the `Config` recipes. Address lists are split with
  `effect/Array`, blanks dropped, and each entry checked against a `Schema`
  email pattern; a bad value fails the deploy with a `ConfigError` naming the
  offending entries.
- `src/forward.ts` — the fan-out: `Effect.partition` forwards one message to
  every target concurrently and decides when to accept vs. fail for Cloudflare's
  retry model.
- `src/EmailRouter.ts` — the Worker itself. Reads config with `effect/Config` in
  the Construction phase, subscribes to inbound mail with
  `Cloudflare.email({ zone, matchers })`, and exposes `GET /healthz` over
  Effect's HTTP API.

Config is read with `effect/Config` in the Worker's Construction phase: Alchemy
reads each value from the deploy environment (Bun loads `.env`), binds it to the
Worker, and re-resolves it from that binding at runtime. There is no
`process.env` plumbing, binding map, or deploy/runtime drift to maintain.

`Cloudflare.email({ zone, matchers })` auto-creates the zone's Email Routing
toggle and the routing resource (the catch-all, or one literal `Email.Rule` per
inbound address when `MAIL_MATCH_MODE=literal`) that hands matched mail to the
Worker — no manual dashboard wiring.

## Setup

```sh
bun install
cp .env.example .env   # then edit
```

At minimum set `MAIL_ZONE` and `MAIL_FORWARD_TO`:

```dotenv
MAIL_ZONE=example.com
MAIL_MATCH_MODE=catch-all          # or "literal"
MAIL_INBOUND=inbox@example.com     # used when MAIL_MATCH_MODE=literal
MAIL_FORWARD_TO=you@gmail.com,you@outlook.com
```

Every address in `MAIL_FORWARD_TO` must be a **verified destination** on the
Cloudflare account (Cloudflare emails a confirmation link the first time each is
added).

## Deploy

Authenticate once, then deploy:

```sh
bunx alchemy profile edit --add Cloudflare   # OAuth or an API token
bun run deploy                               # alchemy deploy
```

Other scripts: `bun run dev` (`alchemy dev`, local workerd), `bun run destroy`,
`bun run logs`, `bun run tail`.

After deploying, `GET <worker-url>/healthz` returns a minimal liveness check (`{ "ok": true }`).

## Develop & check

Vite+ is the toolchain — it never builds the Worker (Alchemy bundles it):

```sh
bun run check      # vp check: Oxfmt + Oxlint + tsgo type-check
bun run check:fix  # autofix
bun run test       # vp test: Vitest 5
```

`alchemy dev` runs the Worker locally (including a local email simulator).

## Changing the config

- Every `MAIL_*` value is bound onto the Worker (as a secret env binding, per
  Alchemy's `Config` semantics) and re-read at runtime, so editing `.env` and
  re-deploying updates behavior without code changes. Malformed values (e.g. a
  bad address in `MAIL_FORWARD_TO`, or an unknown `MAIL_MATCH_MODE`) fail the
  deploy instead of being silently ignored.
- Switching `MAIL_MATCH_MODE` between `catch-all` and `literal` changes which
  routing resource Alchemy manages (catch-all singleton vs. literal rules).
