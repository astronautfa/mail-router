import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

import EmailRouter from "./src/email-router.ts";

export default Alchemy.Stack(
  "MailRouter",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* stack() {
    const router = yield* EmailRouter;

    return {
      url: router.url.as<string>(),
    };
  })
);
