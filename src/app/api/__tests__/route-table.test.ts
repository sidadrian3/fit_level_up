/// <reference types="vite/client" />
import { describe, expect, it, vi } from "vitest";
import type { DefinedRoute } from "@/server/platform/http";

vi.mock("@/lib/auth/rate-limit", () => ({ RateLimit: { limit: vi.fn() } }));
vi.mock("@/lib/auth/auth-helpers", () => ({ getAuthUserId: vi.fn() }));

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
    for (const { label, method, handler } of await loadRoutes()) {
      const definition = handler.definition;
      if (!definition) {
        violations.push(`${label}: missing .definition`);
        continue;
      }
      if (definition.auth === "user" && MUTATING_METHODS.has(method)) {
        if (!("body" in definition)) violations.push(`${label}: user mutation must state "body"`);
        if (!("throttle" in definition)) violations.push(`${label}: user mutation must state "throttle"`);
      }
      if (definition.auth !== "user" && definition.throttle != null) {
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
