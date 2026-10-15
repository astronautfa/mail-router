/**
 * Pure predicate for the Worker's liveness endpoint.
 *
 * Kept in its own module (no `effect`/`alchemy` imports) so the routing
 * decision is unit-testable without mocking Effect's HTTP request service.
 * The handler in `src/EmailRouter.ts` builds the actual response.
 */
export const isHealthCheck = (method: string, pathname: string): boolean =>
  method === "GET" && pathname === "/healthz";
