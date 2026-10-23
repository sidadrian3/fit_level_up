import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { env } from "@/server/platform/env";
import { DomainError } from "@/server/platform/domain";
import { ForbiddenError, UnauthorizedError, createDefineRoute, idParams } from "..";
import type { RateLimitResult } from "..";

const NOW = 1_000_000;

function setup(options: { limitResult?: RateLimitResult | Error; userId?: string | Error } = {}) {
  const { limitResult = { success: true, reset: 0 }, userId = "user-1" } = options;
  const requireUserId = vi.fn(async () => {
    if (userId instanceof Error) throw userId;
    return userId;
  });
  const limit = vi.fn(async (): Promise<RateLimitResult> => {
    if (limitResult instanceof Error) throw limitResult;
    return limitResult;
  });
  return { requireUserId, limit, defineRoute: createDefineRoute({ requireUserId, limit }) };
}

const post = (body: string, url = "http://localhost/api/x") =>
  new Request(url, { method: "POST", body, headers: { "content-type": "application/json" } });
const get = (url = "http://localhost/api/x", headers?: Record<string, string>) => new Request(url, { headers });

describe("defineRoute", () => {
  it("returns 401 when requireUserId throws", async () => {
    const { defineRoute } = setup({ userId: new UnauthorizedError() });
    const handler = vi.fn(async () => ({}));
    const response = await defineRoute({ name: "t", auth: "user" }, handler)(get());
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  describe("throttle", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("keys the limit by route name and user", async () => {
      const { defineRoute, limit } = setup();
      await defineRoute({ name: "workouts.create", auth: "user", throttle: "standard" }, async () => ({}))(get());
      expect(limit).toHaveBeenCalledWith("standard", "workouts.create:user-1");
    });

    it("sends an expensive route to the expensive limiter", async () => {
      const { defineRoute, limit } = setup();
      await defineRoute({ name: "t", auth: "user", throttle: "expensive" }, async () => ({}))(get());
      expect(limit).toHaveBeenCalledWith("expensive", "t:user-1");
    });

    it("returns 429 with Retry-After from reset, before the handler runs", async () => {
      const { defineRoute } = setup({ limitResult: { success: false, reset: NOW + 29_500 } });
      const handler = vi.fn(async () => ({}));
      const response = await defineRoute({ name: "t", auth: "user", throttle: "standard" }, handler)(get());
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("30");
      expect(await response.json()).toEqual({ error: "Too many requests" });
      expect(handler).not.toHaveBeenCalled();
    });

    it("floors Retry-After at 1 when reset has passed", async () => {
      const { defineRoute } = setup({ limitResult: { success: false, reset: NOW - 5_000 } });
      const response = await defineRoute({ name: "t", auth: "user", throttle: "standard" }, async () => ({}))(get());
      expect(response.headers.get("Retry-After")).toBe("1");
    });

    it("throttles before the body is parsed", async () => {
      const { defineRoute } = setup({ limitResult: { success: false, reset: NOW + 1_000 } });
      const route = defineRoute(
        { name: "t", auth: "user", throttle: "standard", body: z.object({ a: z.string() }) },
        async () => ({})
      );
      expect((await route(post("{not json"))).status).toBe(429);
    });

    it("allows and logs when the limiter throws", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const failure = new Error("ECONNREFUSED");
      const { defineRoute } = setup({ limitResult: failure });
      const handler = vi.fn(async () => ({ ok: true }));
      const response = await defineRoute({ name: "t", auth: "user", throttle: "standard" }, handler)(get());
      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith("[Rate limiter unavailable] t", failure);
    });

    it("logs a limiter timeout and allows the request", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { defineRoute } = setup({ limitResult: { success: true, reset: 0, reason: "timeout" } });
      const response = await defineRoute({ name: "t", auth: "user", throttle: "standard" }, async () => ({}))(get());
      expect(response.status).toBe(200);
      expect(spy).toHaveBeenCalledWith("[Rate limiter unavailable] t", "timeout");
    });
  });

  it("does not call limit when throttle is not set", async () => {
    const { defineRoute, limit } = setup();
    const response = await defineRoute({ name: "t", auth: "user" }, async () => ({ ok: true }))(get());
    expect(response.status).toBe(200);
    expect(limit).not.toHaveBeenCalled();
  });

  it("passes the userId to the handler", async () => {
    const { defineRoute } = setup();
    const response = await defineRoute({ name: "t", auth: "user" }, async ({ userId }) => ({ userId }))(get());
    expect(await response.json()).toEqual({ userId: "user-1" });
  });

  it("returns 400 'Invalid JSON body' for malformed JSON", async () => {
    const { defineRoute } = setup();
    const route = defineRoute({ name: "t", auth: "user", body: z.object({ a: z.string() }) }, async () => ({}));
    const response = await route(post("{not json"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body" });
  });

  it("returns 400 with the first issue message on a Zod failure", async () => {
    const { defineRoute } = setup();
    const route = defineRoute(
      { name: "t", auth: "user", body: z.object({ a: z.string("a must be text") }) },
      async () => ({})
    );
    const response = await route(post(JSON.stringify({ a: 1 })));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "a must be text" });
  });

  it("parses and passes a valid body", async () => {
    const { defineRoute } = setup();
    const route = defineRoute(
      { name: "t", auth: "user", body: z.object({ a: z.string() }) },
      async ({ body }) => ({ echoed: body.a })
    );
    expect(await (await route(post(JSON.stringify({ a: "hi" })))).json()).toEqual({ echoed: "hi" });
  });

  it("does not read the body when none is declared", async () => {
    const { defineRoute } = setup();
    const route = defineRoute({ name: "t", auth: "user" }, async ({ body }) => ({ body: body ?? null }));
    expect(await (await route(post("{not json"))).json()).toEqual({ body: null });
  });

  it.each([
    ["DomainError invalid", new DomainError("invalid", "bad"), 400],
    ["DomainError conflict", new DomainError("conflict", "dup"), 409],
    ["ForbiddenError", new ForbiddenError(), 403],
  ])("maps %s to its status", async (_label, error, status) => {
    const { defineRoute } = setup();
    const response = await defineRoute({ name: "t", auth: "user" }, async () => {
      throw error;
    })(get());
    expect(response.status).toBe(status);
  });

  it("maps an unknown error to 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { defineRoute } = setup();
    const response = await defineRoute({ name: "t", auth: "user" }, async () => {
      throw new Error("boom");
    })(get());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal Server Error" });
    spy.mockRestore();
  });

  it("uses options.status for the response", async () => {
    const { defineRoute } = setup();
    const response = await defineRoute({ name: "t", auth: "user", status: 201 }, async () => ({ id: 1 }))(get());
    expect(response.status).toBe(201);
  });

  it("passes a returned Response through with its headers", async () => {
    const { defineRoute } = setup();
    const response = await defineRoute(
      { name: "t", auth: "user" },
      async () => new Response("stream", { status: 202, headers: { "x-custom": "yes" } })
    )(get());
    expect(response.status).toBe(202);
    expect(response.headers.get("x-custom")).toBe("yes");
    expect(await response.text()).toBe("stream");
  });

  it("parses params and query", async () => {
    const { defineRoute } = setup();
    const route = defineRoute(
      { name: "t", auth: "user", params: idParams, query: z.object({ q: z.string() }) },
      async ({ params, query }) => ({ id: params.id, q: query.q })
    );
    const response = await route(get("http://localhost/api/x?q=abc"), { params: Promise.resolve({ id: "42" }) });
    expect(await response.json()).toEqual({ id: "42", q: "abc" });
  });

  describe("cron auth", () => {
    const run = (headers?: Record<string, string>) => {
      const { defineRoute, requireUserId } = setup();
      const handler = vi.fn(async () => ({ ran: true }));
      return { requireUserId, handler, response: defineRoute({ name: "t", auth: "cron" }, handler)(get(undefined, headers)) };
    };

    it("rejects a missing bearer", async () => {
      const { response, handler, requireUserId } = run();
      expect((await response).status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
      expect(requireUserId).not.toHaveBeenCalled();
    });

    it("rejects a wrong bearer", async () => {
      expect((await run({ authorization: "Bearer nope-nope-nope-nope" }).response).status).toBe(401);
    });

    it("rejects a wrong-length bearer", async () => {
      expect((await run({ authorization: "Bearer x" }).response).status).toBe(401);
    });

    it("runs the handler with the right bearer", async () => {
      const { response, handler } = run({ authorization: `Bearer ${env.CRON_SECRET}` });
      expect((await response).status).toBe(200);
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  it("exposes the options as .definition", () => {
    const { defineRoute } = setup();
    const options = { name: "t", auth: "user", throttle: "standard", status: 201 } as const;
    expect(defineRoute(options, async () => ({})).definition).toEqual(options);
  });
});
