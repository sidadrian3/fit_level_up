import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { env } from "@/server/platform/env";
import { recordEmitted } from "@/server/platform/events";
import { DomainError } from "@/server/platform/domain";
import { ConflictError, ForbiddenError, UnauthorizedError, createDefineRoute, idParams } from "..";
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
  const dispatchEvents = vi.fn<(ids: ObjectId[]) => Promise<void>>(async () => {});
  return { requireUserId, limit, dispatchEvents, defineRoute: createDefineRoute({ requireUserId, limit, dispatchEvents }) };
}

const post = (body: string, url = "http://localhost/api/x") =>
  new Request(url, { method: "POST", body, headers: { "content-type": "application/json" } });
const idempotentPost = (body: string, key?: string) =>
  new Request("http://localhost/api/x", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) },
  });
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

  describe("idempotency", () => {
    const KEY = "0b0e6f5e-7a1c-4b7e-9d3a-2f6f1c1d8a11";
    const options = {
      name: "t",
      auth: "user",
      throttle: "standard",
      body: z.object({ a: z.number(), b: z.string() }),
      idempotency: "required",
      status: 201,
    } as const;
    const validBody = JSON.stringify({ a: 1, b: "x" });

    it("returns 400 without the header", async () => {
      const { defineRoute } = setup();
      const handler = vi.fn(async () => ({ value: {}, replayed: false }));
      const response = await defineRoute(options, handler)(idempotentPost(validBody));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Missing or invalid Idempotency-Key header" });
      expect(handler).not.toHaveBeenCalled();
    });

    it("returns 400 for a non-UUID header", async () => {
      const { defineRoute } = setup();
      const handler = vi.fn(async () => ({ value: {}, replayed: false }));
      const response = await defineRoute(options, handler)(idempotentPost(validBody, "abc"));
      expect(response.status).toBe(400);
      expect(handler).not.toHaveBeenCalled();
    });

    it("accepts a lowercase header name", async () => {
      const { defineRoute } = setup();
      const handler = vi.fn(async ({ idempotency }) => ({ value: { key: idempotency.key }, replayed: false }));
      const response = await defineRoute(options, handler)(idempotentPost(validBody, KEY));
      expect(await response.json()).toEqual({ key: KEY });
    });

    it("rejects a missing header before reading the body", async () => {
      const { defineRoute } = setup();
      const handler = vi.fn(async () => ({ value: {}, replayed: false }));
      const request = idempotentPost("not json");
      const response = await defineRoute(options, handler)(request);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Missing or invalid Idempotency-Key header" });
      expect(request.bodyUsed).toBe(false);
    });

    it("passes a sha256 hex fingerprint of the validated body", async () => {
      const { defineRoute } = setup();
      const handler = vi.fn(async ({ idempotency }) => ({ value: { fp: idempotency.fingerprint }, replayed: false }));
      const response = await defineRoute(options, handler)(idempotentPost(validBody, KEY));
      const { fp } = (await response.json()) as { fp: string };
      expect(fp).toMatch(/^[0-9a-f]{64}$/);
      expect(fp).toBe(createHash("sha256").update(JSON.stringify({ a: 1, b: "x" })).digest("hex"));
    });

    it("fingerprints equal bodies equally regardless of field order", async () => {
      const { defineRoute } = setup();
      const handler = vi.fn(async ({ idempotency }) => ({ value: { fp: idempotency.fingerprint }, replayed: false }));
      const route = defineRoute(options, handler);
      const first = (await (await route(idempotentPost('{"b":"x","a":1}', KEY))).json()) as { fp: string };
      const second = (await (await route(idempotentPost('{"a":1,"b":"x"}', KEY))).json()) as { fp: string };
      expect(first.fp).toBe(second.fp);
    });

    it("adds Idempotent-Replayed on a replay", async () => {
      const { defineRoute } = setup();
      const response = await defineRoute(options, async () => ({ value: { id: 1 }, replayed: true }))(
        idempotentPost(validBody, KEY)
      );
      expect(response.status).toBe(201);
      expect(response.headers.get("Idempotent-Replayed")).toBe("true");
      expect(await response.json()).toEqual({ id: 1 });
    });

    it("omits the header on a new create", async () => {
      const { defineRoute } = setup();
      const response = await defineRoute(options, async () => ({ value: { id: 1 }, replayed: false }))(
        idempotentPost(validBody, KEY)
      );
      expect(response.status).toBe(201);
      expect(response.headers.get("Idempotent-Replayed")).toBeNull();
    });

    it("fingerprints a route that declares no body schema instead of failing", async () => {
      const { defineRoute } = setup();
      const handler = vi.fn(async () => ({ value: { id: 1 }, replayed: false }));
      const response = await defineRoute(
        { name: "t", auth: "user", throttle: "standard", idempotency: "required", status: 201 },
        handler
      )(idempotentPost("", KEY));
      expect(response.status).toBe(201);
      expect(handler).toHaveBeenCalledOnce();
    });

    it("leaves non-idempotent routes untouched", async () => {
      const { defineRoute } = setup();
      const response = await defineRoute({ name: "t", auth: "user" }, async () => ({ plain: true }))(get());
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ plain: true });
    });
  });

  describe("event dispatch", () => {
    it("dispatches the ids a 2xx handler emitted", async () => {
      const { defineRoute, dispatchEvents } = setup();
      const id = new ObjectId();
      await defineRoute({ name: "t", auth: "user" }, async () => {
        recordEmitted(id);
        return {};
      })(get());
      expect(dispatchEvents).toHaveBeenCalledOnce();
      expect(dispatchEvents).toHaveBeenCalledWith([id]);
    });

    it("does not dispatch when the handler throws", async () => {
      const { defineRoute, dispatchEvents } = setup();
      const response = await defineRoute({ name: "t", auth: "user" }, async () => {
        recordEmitted(new ObjectId());
        throw new ConflictError("x");
      })(get());
      expect(response.status).toBe(409);
      expect(dispatchEvents).not.toHaveBeenCalled();
    });

    it("does not dispatch when nothing was emitted", async () => {
      const { defineRoute, dispatchEvents } = setup();
      await defineRoute({ name: "t", auth: "user" }, async () => ({}))(get());
      expect(dispatchEvents).not.toHaveBeenCalled();
    });

    it("dispatches when the handler returns its own Response", async () => {
      const { defineRoute, dispatchEvents } = setup();
      const response = await defineRoute({ name: "t", auth: "user" }, async () => {
        recordEmitted(new ObjectId());
        return new Response(null, { status: 204 });
      })(get());
      expect(response.status).toBe(204);
      expect(dispatchEvents).toHaveBeenCalledOnce();
    });
  });
});
