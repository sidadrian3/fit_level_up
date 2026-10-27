/// <reference types="vite/client" />
import { describe, expect, it, vi } from "vitest";
import { RATE_LIMIT_TIERS } from "@/server/platform/config";
import type { DefinedRoute } from "@/server/platform/http";

vi.mock("@/server/platform/http/rate-limiter", () => ({ createRateLimiter: () => vi.fn() }));
vi.mock("@/server/platform/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/platform/auth")>()),
  requireSessionUserId: vi.fn(),
}));

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const MUTATING_METHODS = new Set<string>(["POST", "PUT", "PATCH", "DELETE"]);
const EXEMPT_ROUTES = ["auth/[...all]"];

interface RegisteredRoute {
  label: string;
  method: string;
  handler: Partial<DefinedRoute>;
}

async function loadRoutes(): Promise<RegisteredRoute[]> {
  const modules = import.meta.glob<Record<string, unknown>>("../**/route.ts");
  const routes: RegisteredRoute[] = [];
  for (const [key, load] of Object.entries(modules)) {
    const routePath = key.replace("../", "").replace("/route.ts", "");
    if (EXEMPT_ROUTES.includes(routePath)) continue;
    const exports = await load();
    for (const method of HTTP_METHODS) {
      if (!(method in exports)) continue;
      routes.push({
        label: `${method} /api/${routePath}`,
        method,
        handler: exports[method] as Partial<DefinedRoute>,
      });
    }
  }
  return routes;
}

describe("route table", () => {
  it("every route is built with defineRoute and obeys its auth tier's rules", async () => {
    const violations: string[] = [];
    const routes = await loadRoutes();
    expect(routes.length).toBeGreaterThan(0);
    for (const { label, method, handler } of routes) {
      const definition = handler.definition;
      if (!definition) {
        violations.push(`${label}: missing .definition`);
        continue;
      }
      if (definition.auth === "user" && MUTATING_METHODS.has(method)) {
        if (definition.body === undefined) violations.push(`${label}: user mutation must state "body" (a schema or null)`);
        if (!(definition.throttle && definition.throttle in RATE_LIMIT_TIERS)) {
          violations.push(`${label}: user mutation must name a throttle tier (${Object.keys(RATE_LIMIT_TIERS).join(" | ")})`);
        }
      }
      if (definition.idempotency !== undefined && !(definition.auth === "user" && method === "POST")) {
        violations.push(`${label}: idempotency is only allowed on user POST routes`);
      }
      if (definition.auth !== "user" && definition.throttle !== undefined) {
        violations.push(`${label}: ${definition.auth} route must not set a throttle`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("route names are unique", async () => {
    const owners = new Map<string, string[]>();
    for (const { label, handler } of await loadRoutes()) {
      const name = handler.definition?.name;
      if (name) owners.set(name, [...(owners.get(name) ?? []), label]);
    }
    const duplicates = [...owners].filter(([, labels]) => labels.length > 1).map(([name, labels]) => `${name}: ${labels.join(", ")}`);
    expect(duplicates).toEqual([]);
  });
});
